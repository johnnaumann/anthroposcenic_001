import {
  COMFYUI_HOST,
  fetchComfyObjectInfo,
  findComfyModelsDirFile,
  getAvailableSamplers,
  parseObjectInfoStringList,
} from '@/lib/comfyui-helpers';
import { ComfyUIWorkflow } from '@/lib/comfyui-workflow-types';

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

export async function getValidSampler(requestedSampler: string): Promise<string> {
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

export async function getAvailableCheckpoints(): Promise<string[]> {
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

export async function getAvailableUpscaleModel(): Promise<string | null> {
  return findComfyModelsDirFile('upscale_models', ['.pth', '.safetensors', '.pt'], {
    preferPattern: /ultrasharp|remacri|siax|nmkd|4x/i,
  });
}

export async function getAvailableControlNet(kind?: string): Promise<string | null> {
  return findComfyModelsDirFile('controlnet', ['.safetensors', '.pth', '.pt'], {
    nameFilter: kind ? (name) => name.toLowerCase().includes(kind.toLowerCase()) : undefined,
  });
}

export function buildSdWorkflow(params: SdWorkflowBuildParams): ComfyUIWorkflow {
  const {
    checkpoint,
    imageFilename,
    description,
    seed,
    steps,
    cfgScale,
    denoiseStrength,
    sampler,
    scheduler,
    negativePrompt,
    maxWidth,
    maxHeight,
    useImageResize,
    useImage,
    txt2imgWidth,
    txt2imgHeight,
    qualityBoost,
    freeU,
    useHires,
    hiresFactor,
    hiresSteps,
    hiresDenoise,
    upscaleModel,
    useTileRefine,
    tileModel,
    controlNetStrength,
  } = params;

  const QUALITY_BOOSTER =
    'highly detailed, intricate, rich texture, expressive brushwork, dramatic lighting, vivid color, dynamic composition, fine art, masterpiece, best quality';
  const ANTI_SOFT_NEGATIVE = 'soft focus, oversmoothed, low detail, plastic texture, motion blur';
  const cleanedDescription = description.trim().replace(/[\s,]+$/, '');
  const positivePrompt = qualityBoost
    ? `${cleanedDescription}, ${QUALITY_BOOSTER}`
    : description;
  const finalNegativePrompt = qualityBoost
    ? `${negativePrompt.trim().replace(/[\s,]+$/, '')}, ${ANTI_SOFT_NEGATIVE}`
    : negativePrompt;

  const workflow: ComfyUIWorkflow = {};

  workflow['ckpt'] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: checkpoint },
    _meta: { title: 'Load Checkpoint' },
  };
  const vae: [string, number] = ['ckpt', 2];

  let modelSrc: [string, number] = ['ckpt', 0];
  if (freeU) {
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

  let baseLatent: [string, number];
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
    baseLatent = ['enc', 0];
  } else {
    workflow['empty'] = {
      class_type: 'EmptyLatentImage',
      inputs: { width: txt2imgWidth, height: txt2imgHeight, batch_size: 1 },
      _meta: { title: 'Empty Latent Image (txt2img)' },
    };
    baseLatent = ['empty', 0];
  }

  workflow['ksampler'] = {
    class_type: 'KSampler',
    inputs: {
      seed,
      steps,
      cfg: cfgScale,
      sampler_name: sampler,
      scheduler,
      denoise: useImage ? denoiseStrength : 1.0,
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
  let imageOut: [string, number] = ['decode', 0];

  if (useHires && upscaleModel) {
    workflow['upscale_model'] = {
      class_type: 'UpscaleModelLoader',
      inputs: { model_name: upscaleModel },
      _meta: { title: 'Load Upscale Model' },
    };
    workflow['upscale'] = {
      class_type: 'ImageUpscaleWithModel',
      inputs: { upscale_model: ['upscale_model', 0], image: ['decode', 0] },
      _meta: { title: 'ESRGAN Upscale' },
    };
    workflow['downscale'] = {
      class_type: 'ImageScaleBy',
      inputs: { image: ['upscale', 0], upscale_method: 'lanczos', scale_by: hiresFactor / 4 },
      _meta: { title: 'Supersample Downscale' },
    };
    workflow['enc_hires'] = {
      class_type: 'VAEEncode',
      inputs: { pixels: ['downscale', 0], vae },
      _meta: { title: 'VAE Encode (Hires)' },
    };

    let refinePos: [string, number] = ['pos', 0];
    let refineNeg: [string, number] = ['neg', 0];
    if (useTileRefine) {
      workflow['cn_loader'] = {
        class_type: 'ControlNetLoader',
        inputs: { control_net_name: tileModel! },
        _meta: { title: 'Load ControlNet (Tile)' },
      };
      workflow['cn_apply'] = {
        class_type: 'ControlNetApplyAdvanced',
        inputs: {
          positive: ['pos', 0],
          negative: ['neg', 0],
          control_net: ['cn_loader', 0],
          image: ['downscale', 0],
          strength: controlNetStrength,
          start_percent: 0,
          end_percent: 0.8,
        },
        _meta: { title: 'Apply ControlNet (Tile)' },
      };
      refinePos = ['cn_apply', 0];
      refineNeg = ['cn_apply', 1];
    }
    workflow['ksampler_hires'] = {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: hiresSteps,
        cfg: cfgScale,
        sampler_name: sampler,
        scheduler,
        denoise: hiresDenoise,
        positive: refinePos,
        negative: refineNeg,
        model: modelSrc,
        latent_image: ['enc_hires', 0],
      },
      _meta: { title: 'Hires Refine Sampler' },
    };
    workflow['decode_hires'] = {
      class_type: 'VAEDecode',
      inputs: { samples: ['ksampler_hires', 0], vae },
      _meta: { title: 'VAE Decode (Hires)' },
    };
    imageOut = ['decode_hires', 0];
  } else if (useHires) {
    workflow['latent_upscale'] = {
      class_type: 'LatentUpscaleBy',
      inputs: { samples: ['ksampler', 0], upscale_method: 'bislerp', scale_by: hiresFactor },
      _meta: { title: 'Latent Upscale' },
    };
    workflow['ksampler_hires'] = {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: hiresSteps,
        cfg: cfgScale,
        sampler_name: sampler,
        scheduler,
        denoise: hiresDenoise,
        positive: ['pos', 0],
        negative: ['neg', 0],
        model: modelSrc,
        latent_image: ['latent_upscale', 0],
      },
      _meta: { title: 'Hires Refine Sampler' },
    };
    workflow['decode_hires'] = {
      class_type: 'VAEDecode',
      inputs: { samples: ['ksampler_hires', 0], vae },
      _meta: { title: 'VAE Decode (Hires)' },
    };
    imageOut = ['decode_hires', 0];
  }

  workflow['save'] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: 'anthroposcenic', images: imageOut },
    _meta: { title: 'Save Image' },
  };

  return workflow;
}
