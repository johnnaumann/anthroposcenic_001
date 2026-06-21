import { DEFAULT_NEGATIVE_PROMPT } from '@/lib/comfyui-defaults';
import {
  buildSdWorkflow,
  prepareSdWorkflowBuildParams,
  SdWorkflowOptions,
} from '@/lib/comfyui-workflow-sd';
import { ComfyUIWorkflow } from '@/lib/comfyui-workflow-types';

export type { ComfyUIWorkflow } from '@/lib/comfyui-workflow-types';

export function isFluxModel(name: string | undefined | null): boolean {
  if (!name) return false;
  return /flux/i.test(name) || name.toLowerCase().endsWith('.gguf');
}

/**
 * Build a Flux.1 workflow. Flux is a different architecture from SD1.5/SDXL:
 *  - GGUF UNet (UnetLoaderGGUF), dual text encoder (CLIP-L + T5 via DualCLIPLoader),
 *    a dedicated VAE, FluxGuidance instead of CFG, and ModelSamplingFlux for shift.
 *  - It is guidance-distilled, so it runs at cfg=1 (the negative prompt is inert) and
 *    its T5 encoder thrives on natural-language prose rather than tag soup.
 * Much simpler than the SD1.5 graph — no FreeU / ControlNet-tile / latent hires.
 */
function buildFluxWorkflow(opts: {
  fluxUnet: string;
  imageFilename: string | null;
  description: string;
  seed: number;
  steps: number;
  denoise: number;
  guidance: number;
  width: number;
  height: number;
  useImage: boolean;
  qualityBoost: boolean;
}): ComfyUIWorkflow {
  const FLUX_CLIP_L = process.env.FLUX_CLIP_L || 'clip_l.safetensors';
  const FLUX_T5 = process.env.FLUX_T5 || 't5xxl_fp8_e4m3fn.safetensors';
  const FLUX_VAE = process.env.FLUX_VAE || 'ae.safetensors';

  const cleaned = opts.description.trim().replace(/[\s,]+$/, '');
  const FLUX_ART_SUFFIX = 'richly detailed, expressive, painterly, fine art, masterful composition';
  const positive = opts.qualityBoost && cleaned
    ? `${cleaned}. ${FLUX_ART_SUFFIX}.`
    : cleaned || 'an abstract artwork';

  const steps = Math.min(30, Math.max(4, Math.round(opts.steps)));
  const workflow: ComfyUIWorkflow = {};

  workflow['unet'] = {
    class_type: 'UnetLoaderGGUF',
    inputs: { unet_name: opts.fluxUnet },
    _meta: { title: 'Load Flux (GGUF)' },
  };
  workflow['dualclip'] = {
    class_type: 'DualCLIPLoader',
    inputs: { clip_name1: FLUX_CLIP_L, clip_name2: FLUX_T5, type: 'flux' },
    _meta: { title: 'DualCLIPLoader (Flux)' },
  };
  workflow['vae'] = {
    class_type: 'VAELoader',
    inputs: { vae_name: FLUX_VAE },
    _meta: { title: 'Load Flux VAE' },
  };
  workflow['model_sampling'] = {
    class_type: 'ModelSamplingFlux',
    inputs: { model: ['unet', 0], max_shift: 1.15, base_shift: 0.5, width: opts.width, height: opts.height },
    _meta: { title: 'ModelSamplingFlux' },
  };
  workflow['pos'] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: positive, clip: ['dualclip', 0] },
    _meta: { title: 'Prompt (T5 + CLIP-L)' },
  };
  workflow['guidance'] = {
    class_type: 'FluxGuidance',
    inputs: { conditioning: ['pos', 0], guidance: opts.guidance },
    _meta: { title: 'Flux Guidance' },
  };
  workflow['neg'] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: '', clip: ['dualclip', 0] },
    _meta: { title: 'Negative (inert at cfg 1)' },
  };

  let latent: [string, number];
  if (opts.useImage && opts.imageFilename) {
    workflow['load'] = {
      class_type: 'LoadImage',
      inputs: { image: opts.imageFilename },
      _meta: { title: 'Load Image' },
    };
    workflow['enc'] = {
      class_type: 'VAEEncode',
      inputs: { pixels: ['load', 0], vae: ['vae', 0] },
      _meta: { title: 'VAE Encode (img2img)' },
    };
    latent = ['enc', 0];
  } else {
    workflow['empty'] = {
      class_type: 'EmptySD3LatentImage',
      inputs: { width: opts.width, height: opts.height, batch_size: 1 },
      _meta: { title: 'Empty Latent (Flux)' },
    };
    latent = ['empty', 0];
  }

  workflow['ksampler'] = {
    class_type: 'KSampler',
    inputs: {
      model: ['model_sampling', 0],
      seed: opts.seed,
      steps,
      cfg: 1.0,
      sampler_name: 'euler',
      scheduler: 'simple',
      denoise: opts.useImage ? opts.denoise : 1.0,
      positive: ['guidance', 0],
      negative: ['neg', 0],
      latent_image: latent,
    },
    _meta: { title: 'KSampler (Flux)' },
  };
  workflow['decode'] = {
    class_type: 'VAEDecode',
    inputs: { samples: ['ksampler', 0], vae: ['vae', 0] },
    _meta: { title: 'VAE Decode' },
  };
  workflow['save'] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: 'anthroposcenic', images: ['decode', 0] },
    _meta: { title: 'Save Image' },
  };

  return workflow;
}

/**
 * Create a complete ComfyUI workflow programmatically.
 */
export async function createComfyUIWorkflow(
  imageFilename: string | null,
  description: string,
  options: SdWorkflowOptions = {}
): Promise<ComfyUIWorkflow> {
  const {
    checkpoint: providedCheckpoint = '',
    seed = Math.floor(Math.random() * 1000000),
    maxWidth = 1024,
    maxHeight = 1024,
    useImageResize = false,
  } = options;

  const steps = options.steps ?? 28;
  const cfgScale = options.cfgScale ?? 7;
  const denoiseStrength = options.denoiseStrength ?? 0.85;
  const requestedSampler = options.sampler ?? 'dpmpp_2m';
  const scheduler = options.scheduler ?? 'karras';
  const negativePrompt = options.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT;

  if (isFluxModel(providedCheckpoint)) {
    return buildFluxWorkflow({
      fluxUnet: providedCheckpoint,
      imageFilename,
      description,
      seed,
      steps: Math.min(options.steps ?? 20, 20),
      denoise: options.denoiseStrength ?? 0.85,
      guidance: 3.5,
      width: options.width ?? maxWidth,
      height: options.height ?? maxHeight,
      useImage: options.useImage !== false && imageFilename !== null,
      qualityBoost: options.qualityBoost !== false,
    });
  }

  return buildSdWorkflow(
    await prepareSdWorkflowBuildParams(imageFilename, description, options, {
      negativePrompt,
      seed,
      maxWidth,
      maxHeight,
      useImageResize,
      steps,
      cfgScale,
      denoiseStrength,
      requestedSampler,
      scheduler,
    })
  );
}
