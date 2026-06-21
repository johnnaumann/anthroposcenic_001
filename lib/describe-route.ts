import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { streamOllamaResponse, imageToBase64 } from '@/lib/ollama';
import { findUploadImageFile } from '@/lib/upload-images';
import { truncatePromptAtLimit } from '@/lib/prompt-limits';
import { sendStreamMessage, sendStreamError, closeStream } from '@/lib/streaming';
import { DescribeRequest } from '@/types';

interface DescribeStreamContext {
  controller: ReadableStreamDefaultController<Uint8Array>;
  streamOpen: boolean;
}

function createDescribeStreamContext(
  controller: ReadableStreamDefaultController<Uint8Array>
): DescribeStreamContext {
  return { controller, streamOpen: true };
}

function failDescribe(ctx: DescribeStreamContext, error: string) {
  sendStreamError(ctx.controller, error);
  ctx.streamOpen = false;
}

function resolveSourceImageIds(body: DescribeRequest): string[] {
  const { imageId, imageIds } = body;
  return (imageIds && imageIds.length > 0 ? imageIds : imageId ? [imageId] : []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
}

async function loadImagesBase64(sourceIds: string[]): Promise<string[] | null> {
  const imagesBase64: string[] = [];
  for (const id of sourceIds) {
    const imageFile = await findUploadImageFile(id);
    if (!imageFile) {
      return null;
    }
    const imageBuffer = await readFile(imageFile.path);
    imagesBase64.push(imageToBase64(imageBuffer, imageFile.mimeType));
  }
  return imagesBase64;
}

async function freeComfyUIMemoryBeforeDescribe(): Promise<void> {
  try {
    const comfyHost = process.env.COMFYUI_HOST || 'http://localhost:8188';
    await fetch(`${comfyHost}/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* ComfyUI not running or unreachable — nothing to free */
  }
}

function resolveDescribeModel(model?: string): string {
  if (model && model !== 'default') {
    return model;
  }
  return process.env.OLLAMA_MODEL || 'anthroposcenic-describe:latest';
}

function buildDescribePrompt(isBlend: boolean): string {
  if (isBlend) {
    return (
      'You are an art critic and prompt engineer. You are shown several artworks. Imagine a single ' +
      'NEW artwork that fuses their styles, moods, colour palettes, forms and techniques into one ' +
      'cohesive, original piece — a synthesis, not a description of any one of them. In flowing natural ' +
      'language, write one vivid image-generation prompt for this imagined fusion: its overall style ' +
      'and medium; the mood and atmosphere; the composition, forms and movement; the colour palette ' +
      'and materials; the texture and mark-making. Be specific and evocative, and lean into the ' +
      'unexpected combinations between the works. Then finish with a short comma-separated list of key ' +
      'style descriptors. Write 2-4 sentences followed by the tags. No preamble, no markdown, no ' +
      'headings, no quotation marks.'
    );
  }

  return (
    'You are an art critic and prompt engineer. Study this artwork closely and write a single, ' +
    'vivid image-generation prompt that captures its essence so an AI can reinterpret and riff on it. ' +
    'In flowing natural language, describe: the overall style and medium; the mood and atmosphere; ' +
    'the composition, forms and sense of movement; the colour palette and materials; the texture, ' +
    'mark-making and technique; and what makes it distinctive. Be specific and evocative — capture ' +
    'nuance, not just a list of objects. Then finish with a short comma-separated list of key style ' +
    'descriptors. Write 2-4 sentences followed by the tags. No preamble, no markdown, no headings, ' +
    'no quotation marks.'
  );
}

function cleanDescription(fullResponse: string): string {
  let description = fullResponse
    .trim()
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  description = truncatePromptAtLimit(description);
  description = description.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
  description = description.replace(/^#{1,6}\s+/gm, '');
  return description.trim();
}

async function streamOllamaDescription(
  ctx: DescribeStreamContext,
  model: string,
  prompt: string,
  imagesBase64: string[]
): Promise<string> {
  let fullResponse = '';
  let tokenCount = 0;

  console.log('[Describe] Sending request to Ollama');

  for await (const token of streamOllamaResponse({
    model,
    prompt,
    images: imagesBase64,
    stream: true,
    capPromptLength: true,
    keepAlive: 0,
  })) {
    tokenCount++;
    fullResponse += token;
    if (ctx.streamOpen) {
      const wasSent = sendStreamMessage(ctx.controller, {
        type: 'token',
        data: token,
      });
      if (!wasSent) {
        console.warn(
          '[Describe] Stream closed during token streaming, but continuing to collect response'
        );
        ctx.streamOpen = false;
      }
    }
  }

  console.log(
    '[Describe] Stream completed. Token count:',
    tokenCount,
    'Response length:',
    fullResponse.length
  );

  if (!fullResponse || fullResponse.trim().length === 0) {
    throw new Error(
      'Empty response from Ollama. The model may not be responding correctly. Please ensure the model is created and Ollama is running.'
    );
  }

  return fullResponse;
}

function sendDescriptionComplete(ctx: DescribeStreamContext, fullResponse: string) {
  const description = cleanDescription(fullResponse);

  if (description) {
    console.log(
      '[Describe] Attempting to send done message with description, length:',
      description.length
    );
    const sent = sendStreamMessage(ctx.controller, {
      type: 'done',
      data: description,
    });
    if (sent) {
      closeStream(ctx.controller);
      console.log('[Describe] Stream closed successfully');
    } else {
      console.warn('[Describe] Failed to send done message - stream already closed by client');
    }
    return;
  }

  console.error(
    '[Describe] Cannot send completion - no description received. Full response:',
    fullResponse.substring(0, 100)
  );
  if (ctx.streamOpen) {
    failDescribe(ctx, 'Failed to generate description. Please check server logs for details.');
  }
}

export async function runDescribeStream(
  request: NextRequest,
  controller: ReadableStreamDefaultController<Uint8Array>
): Promise<void> {
  const ctx = createDescribeStreamContext(controller);

  try {
    const body: DescribeRequest = await request.json();
    const sourceIds = resolveSourceImageIds(body);

    if (sourceIds.length === 0) {
      failDescribe(ctx, 'Image ID is required');
      return;
    }

    const imagesBase64 = await loadImagesBase64(sourceIds);
    if (!imagesBase64) {
      failDescribe(ctx, 'Image not found');
      return;
    }

    await freeComfyUIMemoryBeforeDescribe();

    const modelToUse = resolveDescribeModel(body.model);
    console.log('[Describe] Using model:', modelToUse);
    console.log('[Describe] Model from request:', body.model || 'not provided (will use default)');
    console.log('[Describe] OLLAMA_MODEL env:', process.env.OLLAMA_MODEL || 'not set');
    console.log('[Describe] Final model selected:', modelToUse);

    try {
      const fullResponse = await streamOllamaDescription(
        ctx,
        modelToUse,
        buildDescribePrompt(imagesBase64.length > 1),
        imagesBase64
      );
      sendDescriptionComplete(ctx, fullResponse);
    } catch (streamError) {
      if (ctx.streamOpen) {
        console.error('Describe streaming error:', streamError);
        failDescribe(
          ctx,
          streamError instanceof Error ? streamError.message : 'Failed to generate description'
        );
      } else {
        console.error('Describe error after stream closed:', streamError);
      }
    }
  } catch (error) {
    console.error('Describe error:', error);
    if (ctx.streamOpen) {
      try {
        failDescribe(
          ctx,
          error instanceof Error ? error.message : 'Failed to generate description'
        );
      } catch (sendError) {
        console.error('Failed to send error message (stream may be closed):', sendError);
      }
    } else {
      console.warn('Cannot send error - stream was cancelled');
    }
  }
}

export const DESCRIBE_SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;
