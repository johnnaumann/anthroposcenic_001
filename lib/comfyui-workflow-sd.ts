import {
  COMFYUI_HOST,
  fetchComfyObjectInfo,
  findComfyModelsDirFile,
  getAvailableSamplers,
  parseObjectInfoStringList,
} from '@/lib/comfyui-helpers';
import { appendSdHiresRefine } from '@/lib/comfyui-workflow-sd-hires';
import { ComfyUIWorkflow } from '@/lib/comfyui-workflow-types';

const QUALITY_BOOSTER =
  'highly detailed, intricate, rich texture, expressive brushwork, dramatic lighting, vivid color, dynamic composition, fine art, masterpiece, best quality';
const ANTI_SOFT_NEGATIVE = 'soft focus, oversmoothed, low detail, plastic texture, motion blur';

function buildSdPrompts(
  description: string,
  negativePrompt: string,
  qualityBoost: boolean
): { positivePrompt: string; finalNegativePrompt: string } {
  const cleanedDescription = description.trim().replace(/[\s,]+$/, '');
  const positivePrompt = qualityBoost
    ? `${cleanedDescription}, ${QUALITY_BOOSTER}`
    : description;
  const finalNegativePrompt = qualityBoost
    ? `${negativePrompt.trim().replace(/[\s,]+$/, '')}, ${ANTI_SOFT_NEGATIVE}`
    : negativePrompt;
  return { positivePrompt, finalNegativePrompt };
}

function addSdInputLatent(
  workflow: ComfyUIWorkflow,
  params: {
    useImage: boolean;
    imageFilename: string | null;
    useImageResize: boolean;
    maxWidth: number;
    maxHeight: number;
    txt2imgWidth: number;
    txt2imgHeight: number;
    vae: [string, number];
  }
): [string, number] {
  const {
    useImage,
    imageFilename,
    useImageResize,
    maxWidth,
    maxHeight,
    txt2imgWidth,
    txt2imgHeight,
    vae,
  } = params;

  if (useImage) {
    workflow['load'] = {
      class_type: 'LoadImage',
      inputs: { image: imageFilename! },
      _meta: { title: 'Load Image' },
    };
    let pixelSrc: [string, number] = ['load', 0];
    if (useImageResize) {
      workflow['resize'] = {
        class_type: 'ImageScale',
        inputs: {
          image: ['load', 0],
          upscale_method: 'lanczos',
          crop: 'disabled',
          width: maxWidth,
          height: maxHeight,
        },
        _meta: { title: 'Resize Image' },
      };
      pixelSrc = ['resize', 0];
    }
    workflow['enc'] = {
      class_type: 'VAEEncode',
      inputs: { pixels: pixelSrc, vae },
      _meta: { title: 'VAE Encode' },
    };
    return ['enc', 0];
  }

  workflow['empty'] = {
    class_type: 'EmptyLatentImage',
    inputs: { width: txt2imgWidth, height: txt2imgHeight, batch_size: 1 },
    _meta: { title: 'Empty Latent Image (txt2img)' },
  };
  return ['empty', 0];
}

export interface SdWorkflowBuildParams {
  checkpoint: string;
  imageFilename: string | null;
  description: string;
  seed: number;
  steps: number;
  cfgScale: number;
  denoiseStrength: number;
  sampler: string;
  scheduler: string;
  negativePrompt: string;
  maxWidth: number;
  maxHeight: number;
  useImageResize: boolean;
  useImage: boolean;
  txt2imgWidth: number;
  txt2imgHeight: number;
  qualityBoost: boolean;
  freeU: boolean;
  useHires: boolean;
  hiresFactor: number;
  hiresSteps: number;
  hiresDenoise: number;
  upscaleModel: string | null;
  useTileRefine: boolean;
  tileModel: string | null;
  controlNetStrength: number;
}

export type SdWorkflowOptions = {
  checkpoint?: string;
  seed?: number;
  steps?: number;
  cfgScale?: number;
  denoiseStrength?: number;
  sampler?: string;
  scheduler?: string;
  maxWidth?: number;
  maxHeight?: number;
  useImageResize?: boolean;
  negativePrompt?: string;
  useImage?: boolean;
  width?: number;
  height?: number;
  qualityBoost?: boolean;
  hiresFix?: boolean;
  hiresFactor?: number;
  hiresDenoise?: number;
  upscaleModel?: string;
  freeU?: boolean;
  controlNet?: boolean;
  controlNetModel?: string;
  controlNetStrength?: number;
};

async function resolveSdCheckpoint(providedCheckpoint: string): Promise<string> {
  if (providedCheckpoint) {
    return providedCheckpoint;
  }

  const availableCheckpoints = await getAvailableCheckpoints();
  if (availableCheckpoints.length === 0) {
    throw new Error(
      'No checkpoint models available. Please install a Stable Diffusion checkpoint to comfyui/models/checkpoints/'
    );
  }

  const checkpoint = availableCheckpoints[0];
  console.log(`Using checkpoint: ${checkpoint}`);
  return checkpoint;
}

async function resolveSdHiresSettings(
  options: SdWorkflowOptions,
  steps: number
): Promise<{
  useHires: boolean;
  hiresFactor: number;
  hiresSteps: number;
  upscaleModel: string | null;
  useTileRefine: boolean;
  tileModel: string | null;
  controlNetStrength: number;
  hiresDenoise: number;
}> {
  const useHires = options.hiresFix !== false;
  const hiresFactor = options.hiresFactor ?? 1.5;
  const hiresSteps = Math.max(14, Math.round(steps * 0.55));
  const upscaleModel =
    options.upscaleModel ?? (useHires ? await getAvailableUpscaleModel() : null);
  const controlNetEnabled = options.controlNet !== false;
  const tileModel =
    controlNetEnabled && useHires
      ? (options.controlNetModel ?? (await getAvailableControlNet('tile')))
      : null;
  const useTileRefine = !!(tileModel && upscaleModel);
  const controlNetStrength = options.controlNetStrength ?? 0.65;
  const hiresDenoise =
    options.hiresDenoise ?? (useTileRefine ? 0.55 : upscaleModel ? 0.4 : 0.5);

  return {
    useHires,
    hiresFactor,
    hiresSteps,
    upscaleModel,
    useTileRefine,
    tileModel,
    controlNetStrength,
    hiresDenoise,
  };
}

export async function prepareSdWorkflowBuildParams(
  imageFilename: string | null,
  description: string,
  options: SdWorkflowOptions,
  defaults: {
    negativePrompt: string;
    seed: number;
    maxWidth: number;
    maxHeight: number;
    useImageResize: boolean;
    steps: number;
    cfgScale: number;
    denoiseStrength: number;
    requestedSampler: string;
    scheduler: string;
  }
): Promise<SdWorkflowBuildParams> {
  const checkpoint = await resolveSdCheckpoint(options.checkpoint ?? '');
  const sampler = await getValidSampler(defaults.requestedSampler);
  const useImage = options.useImage !== false && imageFilename !== null;
  const hires = await resolveSdHiresSettings(options, defaults.steps);

  return {
    checkpoint,
    imageFilename,
    description,
    seed: defaults.seed,
    steps: defaults.steps,
    cfgScale: defaults.cfgScale,
    denoiseStrength: defaults.denoiseStrength,
    sampler,
    scheduler: defaults.scheduler,
    negativePrompt: defaults.negativePrompt,
    maxWidth: defaults.maxWidth,
    maxHeight: defaults.maxHeight,
    useImageResize: defaults.useImageResize,
    useImage,
    txt2imgWidth: options.width || defaults.maxWidth,
    txt2imgHeight: options.height || defaults.maxHeight,
    qualityBoost: options.qualityBoost !== false,
    freeU: options.freeU !== false,
    ...hires,
  };
}

async function getValidSampler(requestedSampler: string): Promise<string> {
  const availableSamplers = await getAvailableSamplers();

  if (availableSamplers.includes(requestedSampler)) {
    return requestedSampler;
  }

  const variations: Record<string, string[]> = {
    dpmpp_2m_karras: ['dpmpp_2m', 'dpmpp_2s_ancestral', 'dpm_2_ancestral'],
    dpmpp_2m: ['dpm_2_ancestral', 'euler_ancestral', 'euler'],
    euler_a: ['euler_ancestral', 'euler'],
  };

  if (variations[requestedSampler]) {
    for (const fallback of variations[requestedSampler]) {
      if (availableSamplers.includes(fallback)) {
        console.warn(`Sampler '${requestedSampler}' not available, using '${fallback}' instead`);
        return fallback;
      }
    }
  }

  const fallback = availableSamplers.includes('euler') ? 'euler' : availableSamplers[0] || 'euler';
  console.warn(`Sampler '${requestedSampler}' not available, using '${fallback}' instead`);
  return fallback;
}

async function getAvailableCheckpoints(): Promise<string[]> {
  try {
    const data = await fetchComfyObjectInfo(COMFYUI_HOST);
    const checkpointInfo = (
      data.CheckpointLoaderSimple as { input?: { required?: { ckpt_name?: unknown } } } | undefined
    )?.input?.required?.ckpt_name;
    const list = parseObjectInfoStringList(checkpointInfo);

    if (list) {
      return list;
    }

    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        const { readdir } = await import('fs/promises');
        const { join } = await import('path');
        const checkpointDir = join(process.cwd(), 'comfyui', 'models', 'checkpoints');
        const files = await readdir(checkpointDir);
        return files.filter((file) => file.endsWith('.safetensors') || file.endsWith('.ckpt'));
      } catch (fsError) {
        console.warn('Could not check filesystem for checkpoints:', fsError);
      }
    }

    return [];
  } catch (error) {
    console.error('Failed to get available checkpoints:', error);
    return [];
  }
}

async function getAvailableUpscaleModel(): Promise<string | null> {
  return findComfyModelsDirFile('upscale_models', ['.pth', '.safetensors', '.pt'], {
    preferPattern: /ultrasharp|remacri|siax|nmkd|4x/i,
  });
}

async function getAvailableControlNet(kind?: string): Promise<string | null> {
  return findComfyModelsDirFile('controlnet', ['.safetensors', '.pth', '.pt'], {
    nameFilter: kind ? (name) => name.toLowerCase().includes(kind.toLowerCase()) : undefined,
  });
}

export function buildSdWorkflow(params: SdWorkflowBuildParams): ComfyUIWorkflow {
  const { positivePrompt, finalNegativePrompt } = buildSdPrompts(
    params.description,
    params.negativePrompt,
    params.qualityBoost
  );

  const workflow: ComfyUIWorkflow = {};

  workflow['ckpt'] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: params.checkpoint },
    _meta: { title: 'Load Checkpoint' },
  };
  const vae: [string, number] = ['ckpt', 2];

  let modelSrc: [string, number] = ['ckpt', 0];
  if (params.freeU) {
    workflow['freeu'] = {
      class_type: 'FreeU_V2',
      inputs: { model: ['ckpt', 0], b1: 1.2, b2: 1.3, s1: 0.9, s2: 0.2 },
      _meta: { title: 'FreeU V2' },
    };
    modelSrc = ['freeu', 0];
  }

  workflow['pos'] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: positivePrompt, clip: ['ckpt', 1] },
    _meta: { title: 'CLIP Text Encode (Positive)' },
  };
  workflow['neg'] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: finalNegativePrompt, clip: ['ckpt', 1] },
    _meta: { title: 'CLIP Text Encode (Negative)' },
  };

  const baseLatent = addSdInputLatent(workflow, {
    useImage: params.useImage,
    imageFilename: params.imageFilename,
    useImageResize: params.useImageResize,
    maxWidth: params.maxWidth,
    maxHeight: params.maxHeight,
    txt2imgWidth: params.txt2imgWidth,
    txt2imgHeight: params.txt2imgHeight,
    vae,
  });

  workflow['ksampler'] = {
    class_type: 'KSampler',
    inputs: {
      seed: params.seed,
      steps: params.steps,
      cfg: params.cfgScale,
      sampler_name: params.sampler,
      scheduler: params.scheduler,
      denoise: params.useImage ? params.denoiseStrength : 1.0,
      positive: ['pos', 0],
      negative: ['neg', 0],
      model: modelSrc,
      latent_image: baseLatent,
    },
    _meta: { title: 'KSampler (Base)' },
  };

  workflow['decode'] = {
    class_type: 'VAEDecode',
    inputs: { samples: ['ksampler', 0], vae },
    _meta: { title: 'VAE Decode (Base)' },
  };

  const imageOut = appendSdHiresRefine(
    workflow,
    {
      seed: params.seed,
      hiresSteps: params.hiresSteps,
      cfgScale: params.cfgScale,
      sampler: params.sampler,
      scheduler: params.scheduler,
      hiresDenoise: params.hiresDenoise,
      hiresFactor: params.hiresFactor,
      upscaleModel: params.upscaleModel,
      useHires: params.useHires,
      useTileRefine: params.useTileRefine,
      tileModel: params.tileModel,
      controlNetStrength: params.controlNetStrength,
      modelSrc,
      vae,
    },
    ['decode', 0]
  );

  workflow['save'] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: 'anthroposcenic', images: imageOut },
    _meta: { title: 'Save Image' },
  };

  return workflow;
}
