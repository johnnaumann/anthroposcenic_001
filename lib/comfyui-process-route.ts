import { readFile, copyFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { NextRequest } from 'next/server';
import {
  queueComfyUIWorkflow,
  createComfyUIWorkflow,
  isFluxModel,
  findLatestOutputImage,
} from '@/lib/comfyui';
import { pollComfyUIJob } from '@/lib/comfyui-poll';
import { startComfyUI } from '@/lib/comfyui-startup';
import {
  ensureCheckpoint,
  isCorruptionError,
  checkpointExists,
  checkpointAppearsValid,
} from '@/lib/model-downloader';
import { findUploadImageFile } from '@/lib/upload-images';
import { closeStream, sendStreamError, sendStreamMessage } from '@/lib/streaming';
import { createProgressAggregator, getSamplingPhases } from '@/lib/processing-progress';
import { ComfyUIConfig, ComfyUIProcessRequest, ComfyUIProgressUpdate } from '@/types';

const CHECKPOINTS_DIR = join(process.cwd(), 'comfyui', 'models', 'checkpoints');

interface ProcessStreamContext {
  controller: ReadableStreamDefaultController<Uint8Array>;
  streamOpen: boolean;
}

function createProcessStreamContext(
  controller: ReadableStreamDefaultController<Uint8Array>
): ProcessStreamContext {
  return { controller, streamOpen: true };
}

function sendStatus(ctx: ProcessStreamContext, data: string) {
  ctx.streamOpen = sendStreamMessage(ctx.controller, { type: 'status', data });
}

function failProcess(ctx: ProcessStreamContext, error: string) {
  sendStreamError(ctx.controller, error);
  ctx.streamOpen = false;
}

function downloadProgressMessage(label: string, progress: number): string {
  if (typeof progress === 'number' && progress <= 100) {
    return `${label}: ${Math.round(progress)}%`;
  }

  const mb = (progress / (1024 * 1024)).toFixed(2);
  return `${label}: ${mb} MB downloaded...`;
}

function sendDownloadProgress(ctx: ProcessStreamContext, label: string, progress: number) {
  if (!ctx.streamOpen) {
    return;
  }

  sendStatus(ctx, downloadProgressMessage(label, progress));
  if (typeof progress === 'number' && progress <= 100) {
    console.log(`[ComfyUI Process] ${label}: ${Math.round(progress)}%`);
  } else {
    console.log(`[ComfyUI Process] ${label}: ${(progress / (1024 * 1024)).toFixed(2)} MB`);
  }
}

async function deleteCheckpointFile(checkpoint: string): Promise<void> {
  await unlink(join(CHECKPOINTS_DIR, checkpoint));
}

async function ensureCheckpointWithProgress(
  ctx: ProcessStreamContext,
  checkpoint: string,
  label: string,
  forceRedownload = false
): Promise<boolean> {
  return ensureCheckpoint(
    checkpoint,
    (progress) => sendDownloadProgress(ctx, label, progress as number),
    forceRedownload
  );
}

async function repairCorruptedCheckpoint(
  ctx: ProcessStreamContext,
  checkpoint: string,
  label: string
): Promise<boolean> {
  sendStatus(ctx, 'Model file appears corrupted. Re-downloading...');
  console.warn(
    `[ComfyUI Process] Model file "${checkpoint}" exists but appears invalid (too small). Attempting to re-download...`
  );

  try {
    await deleteCheckpointFile(checkpoint);
    console.log('[ComfyUI Process] Deleted corrupted file');

    const reDownloaded = await ensureCheckpointWithProgress(
      ctx,
      checkpoint,
      label,
      true
    );

    if (!reDownloaded) {
      failProcess(
        ctx,
        `Failed to re-download model "${checkpoint}". Please download it manually.`
      );
      return false;
    }

    console.log('[ComfyUI Process] Model re-downloaded successfully');
    return true;
  } catch (error) {
    console.error('[ComfyUI Process] Error re-downloading model:', error);
    failProcess(
      ctx,
      `Failed to re-download corrupted model "${checkpoint}". Please delete it manually and try again.`
    );
    return false;
  }
}

async function parseProcessRequestBody(
  request: NextRequest
): Promise<ComfyUIProcessRequest | 'empty' | 'invalid'> {
  try {
    const rawBody = await request.text();
    if (!rawBody.trim()) {
      return 'empty';
    }

    return JSON.parse(rawBody) as ComfyUIProcessRequest;
  } catch {
    return 'invalid';
  }
}

function validateProcessRequest(body: ComfyUIProcessRequest): string | null {
  if (!body.config) {
    return 'Config is required';
  }

  if (!body.config.description || !body.config.checkpoint) {
    return 'Config must include description and checkpoint';
  }

  const useImage = body.useImage ?? true;
  if (useImage && !body.imageId) {
    return 'Image ID is required when using image-to-image mode';
  }

  return null;
}

async function ensureProcessCheckpoint(
  ctx: ProcessStreamContext,
  config: ComfyUIConfig
): Promise<boolean> {
  if (isFluxModel(config.checkpoint)) {
    sendStatus(ctx, `Using Flux model: ${config.checkpoint}`);
    return true;
  }

  sendStatus(ctx, `Checking for model: ${config.checkpoint}...`);
  console.log(`[ComfyUI Process] Checking for model: ${config.checkpoint}`);

  const checkpointReady = await ensureCheckpointWithProgress(
    ctx,
    config.checkpoint,
    'Downloading model'
  );

  if (!checkpointReady) {
    const errorMsg = `Model ${config.checkpoint} is not available and could not be downloaded automatically. Please download it manually to: comfyui/models/checkpoints/`;
    console.error(`[ComfyUI Process] ${errorMsg}`);
    failProcess(ctx, errorMsg);
    return false;
  }

  if (!checkpointAppearsValid(config.checkpoint)) {
    return repairCorruptedCheckpoint(ctx, config.checkpoint, 'Re-downloading model');
  }

  return true;
}

async function prepareComfyImageInput(
  ctx: ProcessStreamContext,
  imageId: string
): Promise<string | null> {
  const imageFile = await findUploadImageFile(imageId);
  if (!imageFile) {
    failProcess(ctx, 'Image not found');
    return null;
  }

  sendStatus(ctx, 'Preparing image for ComfyUI...');

  try {
    const comfyInputDir = join(process.cwd(), 'comfyui', 'input');
    await mkdir(comfyInputDir, { recursive: true });

    const extension = imageFile.path.split('.').pop() || 'png';
    const filename = `${imageId}.${extension}`;
    await copyFile(imageFile.path, join(comfyInputDir, filename));
    return filename;
  } catch (error) {
    console.warn('Failed to copy image to ComfyUI input, using filename:', error);
    return imageFile.path.split('/').pop() || `${imageId}.png`;
  }
}

function finishProcessWithImage(ctx: ProcessStreamContext, imageUrl: string): boolean {
  ctx.streamOpen = sendStreamMessage(ctx.controller, {
    type: 'image',
    data: imageUrl,
  });

  if (ctx.streamOpen) {
    sendStreamMessage(ctx.controller, {
      type: 'done',
      data: 'Processing complete',
    });
    closeStream(ctx.controller);
  }

  return ctx.streamOpen;
}

async function resolveOutputImageUrl(
  promptId: string,
  jobStartTime: number,
  imageUrl?: string
): Promise<string | null> {
  if (imageUrl) {
    return imageUrl;
  }

  const foundImage = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
  return foundImage?.imageUrl ?? null;
}

async function handleRuntimeCorruptionError(
  ctx: ProcessStreamContext,
  checkpoint: string
): Promise<void> {
  sendStatus(ctx, `Model file "${checkpoint}" is corrupted. Attempting to re-download...`);

  try {
    if (checkpointExists(checkpoint)) {
      const corruptedFilePath = join(CHECKPOINTS_DIR, checkpoint);
      console.log(`[Process Route] Deleting corrupted file: ${corruptedFilePath}`);
      await unlink(corruptedFilePath);
      console.log('[Process Route] Deleted corrupted file');
    }

    sendStatus(ctx, `Re-downloading model: ${checkpoint}...`);

    const checkpointReady = await ensureCheckpointWithProgress(
      ctx,
      checkpoint,
      'Re-downloading model',
      true
    );

    if (checkpointReady) {
      console.log(`[Process Route] Model re-downloaded successfully: ${checkpoint}`);
      sendStatus(ctx, 'Model re-downloaded successfully. Please try processing again.');
      failProcess(
        ctx,
        `Model "${checkpoint}" was corrupted and has been re-downloaded. Please try processing your image again.`
      );
      return;
    }

    const errorMsg = `Failed to re-download model "${checkpoint}". Please download it manually to: comfyui/models/checkpoints/`;
    console.error(`[Process Route] ${errorMsg}`);
    failProcess(ctx, errorMsg);
  } catch (redownloadError) {
    console.error('[Process Route] Error during model re-download:', redownloadError);
    failProcess(
      ctx,
      `Model file "${checkpoint}" is corrupted. Failed to automatically re-download. Please delete the file manually and try again:\n\n` +
        `1. Delete: comfyui/models/checkpoints/${checkpoint}\n` +
        `2. Try processing again (it will auto-download), or\n` +
        `3. Download manually from Hugging Face`
    );
  }
}

async function handlePollUpdate(
  ctx: ProcessStreamContext,
  update: ComfyUIProgressUpdate,
  config: ComfyUIConfig,
  promptId: string,
  jobStartTime: number,
  progressAggregator: ReturnType<typeof createProgressAggregator>
): Promise<'continue' | 'done' | 'failed'> {
  console.log('[Process Route] Received update:', {
    status: update.status,
    progress: update.progress,
    hasImageUrl: !!update.imageUrl,
    imageUrl: update.imageUrl,
  });

  if (update.status === 'complete') {
    const imageUrl = await resolveOutputImageUrl(promptId, jobStartTime, update.imageUrl);
    if (imageUrl) {
      console.log(`[Process Route] Job complete! Sending image URL to frontend: ${imageUrl}`);
      finishProcessWithImage(ctx, imageUrl);
      return 'done';
    }

    console.error('[Process Route] Job completed but could not find image file');
    if (ctx.streamOpen) {
      failProcess(
        ctx,
        'Processing completed but image not found. Check ComfyUI output directory.'
      );
    }
    return 'failed';
  }

  if (update.status === 'error') {
    console.error(`[Process Route] ComfyUI error: ${update.error}`);
    const errorMessage = update.error || '';

    if (isCorruptionError(errorMessage)) {
      console.log(`[Process Route] Detected corrupted model: ${config.checkpoint}`);
      await handleRuntimeCorruptionError(ctx, config.checkpoint);
      return 'failed';
    }

    if (ctx.streamOpen) {
      failProcess(ctx, update.error || 'ComfyUI processing failed');
    }
    return 'failed';
  }

  if (update.status === 'timeout') {
    console.error('[Process Route] ComfyUI timeout');
    const foundImage = await findLatestOutputImage(
      promptId,
      'anthroposcenic',
      Date.now() - 300_000
    );

    if (foundImage && ctx.streamOpen) {
      console.log(`[Process Route] Found image after timeout: ${foundImage.imageUrl}`);
      finishProcessWithImage(ctx, foundImage.imageUrl);
      return 'done';
    }

    if (ctx.streamOpen) {
      failProcess(ctx, 'ComfyUI processing timed out');
    }
    return 'failed';
  }

  if (update.progress !== undefined && ctx.streamOpen) {
    const snapshot = progressAggregator.update(update.progress, update.step, update.stepMax);
    ctx.streamOpen = sendStreamMessage(ctx.controller, {
      type: 'progress',
      data: snapshot,
    });
  } else if (update.executionComplete && ctx.streamOpen) {
    const snapshot = progressAggregator.complete();
    ctx.streamOpen = sendStreamMessage(ctx.controller, {
      type: 'progress',
      data: snapshot,
    });
  } else if (ctx.streamOpen) {
    ctx.streamOpen = sendStreamMessage(ctx.controller, {
      type: 'status',
      data: update.status,
    });
  }

  return 'continue';
}

export async function runComfyUIProcessStream(
  request: NextRequest,
  controller: ReadableStreamDefaultController<Uint8Array>
): Promise<void> {
  const ctx = createProcessStreamContext(controller);

  try {
    const parsed = await parseProcessRequestBody(request);
    if (parsed === 'empty') {
      closeStream(controller);
      return;
    }

    if (parsed === 'invalid') {
      failProcess(ctx, 'Invalid request body');
      return;
    }

    const validationError = validateProcessRequest(parsed);
    if (validationError) {
      failProcess(ctx, validationError);
      return;
    }

    const {
      imageId,
      config,
      workflow: customWorkflow,
      useImage = true,
      width = 1024,
      height = 1024,
    } = parsed;

    sendStatus(ctx, 'Starting ComfyUI...');

    const comfyuiReady = await startComfyUI();
    if (!comfyuiReady) {
      failProcess(
        ctx,
        'Failed to start ComfyUI. Please ensure ComfyUI is set up: npm run setup:comfyui'
      );
      return;
    }

    if (!(await ensureProcessCheckpoint(ctx, config))) {
      return;
    }

    console.log(`[ComfyUI Process] Model ready: ${config.checkpoint}`);
    console.log(`[ComfyUI Process] Mode: ${useImage ? 'img2img' : 'txt2img'}`);

    let comfyImageFilename: string | null = null;

    if (useImage && imageId) {
      comfyImageFilename = await prepareComfyImageInput(ctx, imageId);
      if (!comfyImageFilename) {
        return;
      }
    } else {
      sendStatus(ctx, 'Using text-to-image mode (no input image)...');
    }

    const workflow = customWorkflow
      ? JSON.parse(customWorkflow)
      : await createComfyUIWorkflow(comfyImageFilename, config.description, {
          checkpoint: config.checkpoint,
          steps: config.steps,
          cfgScale: config.cfgScale,
          denoiseStrength: config.denoiseStrength,
          sampler: config.sampler,
          scheduler: config.scheduler,
          negativePrompt: config.negativePrompt,
          useImageResize: false,
          useImage,
          width,
          height,
          hiresFix: config.hiresFix,
          hiresFactor: config.hiresFactor,
          hiresDenoise: config.hiresDenoise,
          controlNet: config.controlNet,
          controlNetStrength: config.controlNetStrength,
          freeU: config.freeU,
          qualityBoost: config.qualityBoost,
        });

    sendStatus(ctx, 'Submitting workflow to ComfyUI...');

    const queueResponse = await queueComfyUIWorkflow(workflow);
    const promptId = queueResponse.prompt_id;
    const jobStartTime = Date.now();

    sendStreamMessage(ctx.controller, {
      type: 'meta',
      data: { promptId, jobStartTime },
    });
    sendStatus(ctx, `Workflow queued (ID: ${promptId})`);

    let lastUpdate: ComfyUIProgressUpdate | null = null;
    const progressAggregator = createProgressAggregator(getSamplingPhases(config));

    for await (const update of pollComfyUIJob(promptId)) {
      lastUpdate = update;
      const result = await handlePollUpdate(
        ctx,
        update,
        config,
        promptId,
        jobStartTime,
        progressAggregator
      );

      if (result !== 'continue') {
        return;
      }
    }

    if (lastUpdate && lastUpdate.status !== 'complete') {
      console.warn(
        `[Process Route] Polling loop ended without completion. Last status: ${lastUpdate.status}`
      );
      const foundImage = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
      if (foundImage) {
        console.log(`[Process Route] Found image after polling ended: ${foundImage.imageUrl}`);
        finishProcessWithImage(ctx, foundImage.imageUrl);
      }
    }
  } catch (error) {
    console.error('ComfyUI process error:', error);
    failProcess(
      ctx,
      error instanceof Error ? error.message : 'Failed to process with ComfyUI'
    );
  }
}

export const COMFYUI_PROCESS_SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;
