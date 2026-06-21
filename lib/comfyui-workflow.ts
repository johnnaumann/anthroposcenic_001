import { DEFAULT_NEGATIVE_PROMPT } from '@/lib/comfyui-defaults';
import {
  COMFYUI_HOST,
  fetchComfyObjectInfo,
  findComfyModelsDirFile,
  getAvailableSamplers,
  parseObjectInfoStringList,
} from '@/lib/comfyui-helpers';

export interface ComfyUIWorkflowNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: {
    title?: string;
  };
}

export interface ComfyUIWorkflow {
  [nodeId: string]: ComfyUIWorkflowNode;
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
  denoise: number; // img2img strength (0-1); higher = bolder reinterpretation
  guidance: number; // FluxGuidance (≈3.5 for [dev])
  width: number;
  height: number;
  useImage: boolean;
  qualityBoost: boolean;
}): ComfyUIWorkflow {
  const FLUX_CLIP_L = process.env.FLUX_CLIP_L || 'clip_l.safetensors';
  const FLUX_T5 = process.env.FLUX_T5 || 't5xxl_fp8_e4m3fn.safetensors';
  const FLUX_VAE = process.env.FLUX_VAE || 'ae.safetensors';

  // Flux speaks natural language — feed the rich description directly. A light art
  // nudge (not photographic "masterpiece" tag soup) when quality boost is on.
  const cleaned = opts.description.trim().replace(/[\s,]+$/, '');
  const FLUX_ART_SUFFIX = 'richly detailed, expressive, painterly, fine art, masterful composition';
  const positive = opts.qualityBoost && cleaned
    ? `${cleaned}. ${FLUX_ART_SUFFIX}.`
    : cleaned || 'an abstract artwork';

  // Allow schnell's 4 steps through; cap dev at 30.
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
  // Flux runs at cfg=1, so the negative is ignored — but KSampler still needs one.
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
 * Create a complete ComfyUI workflow programmatically
 * This builds a workflow that:
 * 1. Loads the input image
 * 2. Encodes the text description using CLIP
 * 3. Processes the image (image-to-image or other processing)
 * 4. Saves the output
 * 
 * @param imageFilename - Filename of the image in ComfyUI's input directory
 * @param description - Text description/prompt for processing
 * @param options - Optional workflow configuration
 */
export async function createComfyUIWorkflow(
  imageFilename: string | null, // null for text-to-image
  description: string,
  options: {
    checkpoint?: string; // Model checkpoint name (default: first available)
    seed?: number; // Random seed
    steps?: number; // Number of sampling steps
    cfgScale?: number; // CFG scale (lower = more creative, higher = more prompt adherence)
    denoiseStrength?: number; // Denoising strength for img2img (0-1, higher = more variation)
    sampler?: string; // Sampler name (e.g., 'euler', 'dpmpp_2m', 'dpmpp_2m_karras', 'euler_a')
    scheduler?: string; // Scheduler (e.g., 'normal', 'karras', 'exponential', 'simple')
    maxWidth?: number; // Maximum image width (optional, images are now compressed at upload)
    maxHeight?: number; // Maximum image height (optional, images are now compressed at upload)
    useImageResize?: boolean; // Whether to use ImageScale node (default: false, images are pre-compressed)
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
  } = {}
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

  // ── Flux short-circuit ───────────────────────────────────────────────────────
  // Flux is a different architecture (T5 prose, guidance not CFG, GGUF UNet). When a
  // Flux model is selected, build its own (simpler) graph and skip the SD1.5 builder.
  if (isFluxModel(providedCheckpoint)) {
    return buildFluxWorkflow({
      fluxUnet: providedCheckpoint,
      imageFilename,
      description,
      seed,
      // Flux [dev] looks great at ~20 steps; cap it (don't inherit SD1.5's 28) since
      // each step is ~30s on the M4 — 20 steps ≈ ~10 min, 28 would be ~14 min.
      steps: Math.min(options.steps ?? 20, 20),
      denoise: options.denoiseStrength ?? 0.85,
      guidance: 3.5, // Flux [dev] sweet spot; CFG/sampler/scheduler from the UI don't apply
      width: options.width ?? maxWidth,
      height: options.height ?? maxHeight,
      useImage: options.useImage !== false && imageFilename !== null,
      qualityBoost: options.qualityBoost !== false,
    });
  }

  // Get available checkpoints if none provided
  let checkpoint = providedCheckpoint;
  if (!checkpoint) {
    const availableCheckpoints = await getAvailableCheckpoints();
    if (availableCheckpoints.length === 0) {
      throw new Error('No checkpoint models available. Please install a Stable Diffusion checkpoint to comfyui/models/checkpoints/');
    }
    checkpoint = availableCheckpoints[0];
    console.log(`Using checkpoint: ${checkpoint}`);
  }

  const sampler = await getValidSampler(requestedSampler);

  // Determine if using image (img2img) or text-to-image (txt2img)
  const useImage = options.useImage !== false && imageFilename !== null;
  const txt2imgWidth = options.width || maxWidth;
  const txt2imgHeight = options.height || maxHeight;

  // Quality boosters: appended to the positive prompt to push toward crisp,
  // high-resolution, photographic-grade micro-detail while keeping the
  // generative/computer-art character. Style-agnostic (no "photo of ...").
  const qualityBoost = options.qualityBoost !== false;
  const QUALITY_BOOSTER = 'highly detailed, intricate, rich texture, expressive brushwork, dramatic lighting, vivid color, dynamic composition, fine art, masterpiece, best quality';
  const ANTI_SOFT_NEGATIVE = 'soft focus, oversmoothed, low detail, plastic texture, motion blur';
  const cleanedDescription = description.trim().replace(/[\s,]+$/, '');
  const positivePrompt = qualityBoost
    ? `${cleanedDescription}, ${QUALITY_BOOSTER}`
    : description;
  const finalNegativePrompt = qualityBoost
    ? `${negativePrompt.trim().replace(/[\s,]+$/, '')}, ${ANTI_SOFT_NEGATIVE}`
    : negativePrompt;

  // FreeU_V2 sharpens and enriches SD1.5 output for free (no extra model).
  const freeU = options.freeU !== false;

  // Hires / detail pass. The biggest fix for "blurry up close" is to upscale in
  // PIXEL space with an ESRGAN model (if installed), supersample back down to the
  // target size, then run a higher-denoise refine so the model redraws real
  // micro-texture — far crisper than a latent upscale. Falls back to an improved
  // latent upscale when no upscale model is available.
  const useHires = options.hiresFix !== false;
  const hiresFactor = options.hiresFactor ?? 1.5;
  const hiresSteps = Math.max(14, Math.round(steps * 0.55));
  const upscaleModel = options.upscaleModel ?? (useHires ? await getAvailableUpscaleModel() : null);

  // ControlNet Tile (SD1.5): guides the refine pass so it can run a HIGHER denoise —
  // redrawing genuine micro-texture — without drifting off the upscaled structure.
  // Requires the ESRGAN image path (it conditions on the upscaled image).
  const controlNetEnabled = options.controlNet !== false;
  const tileModel = controlNetEnabled && useHires
    ? (options.controlNetModel ?? (await getAvailableControlNet('tile')))
    : null;
  const useTileRefine = !!(tileModel && upscaleModel);
  const controlNetStrength = options.controlNetStrength ?? 0.65;

  // Refine denoise: tile-guided refine can go hard (structure is held); plain ESRGAN
  // refine stays moderate; the latent fallback needs more to overcome its softness.
  const hiresDenoise = options.hiresDenoise ?? (useTileRefine ? 0.55 : upscaleModel ? 0.4 : 0.5);

  // ── Assemble the workflow graph ──────────────────────────────────────────────
  // Node IDs are arbitrary string keys; links are [nodeId, outputSlot].
  const workflow: ComfyUIWorkflow = {};

  // Checkpoint → MODEL[0], CLIP[1], VAE[2]
  workflow['ckpt'] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: checkpoint },
    _meta: { title: 'Load Checkpoint' },
  };
  const vae: [string, number] = ['ckpt', 2];

  // Optional FreeU on the model path (feeds every sampler).
  let modelSrc: [string, number] = ['ckpt', 0];
  if (freeU) {
    workflow['freeu'] = {
      class_type: 'FreeU_V2',
      inputs: { model: ['ckpt', 0], b1: 1.2, b2: 1.3, s1: 0.9, s2: 0.2 },
      _meta: { title: 'FreeU V2' },
    };
    modelSrc = ['freeu', 0];
  }

  // Prompts
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

  // Base latent: img2img encodes the input image; txt2img uses an empty latent.
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

  // Base sampler
  workflow['ksampler'] = {
    class_type: 'KSampler',
    inputs: {
      seed,
      steps,
      cfg: cfgScale,
      sampler_name: sampler,
      scheduler,
      denoise: useImage ? denoiseStrength : 1.0, // full denoise for txt2img
      positive: ['pos', 0],
      negative: ['neg', 0],
      model: modelSrc,
      latent_image: baseLatent,
    },
    _meta: { title: 'KSampler (Base)' },
  };

  // Decode the base pass; the hires branch below may supersede the output.
  workflow['decode'] = {
    class_type: 'VAEDecode',
    inputs: { samples: ['ksampler', 0], vae },
    _meta: { title: 'VAE Decode (Base)' },
  };
  let imageOut: [string, number] = ['decode', 0];

  if (useHires && upscaleModel) {
    // Best path: pixel-space ESRGAN upscale → supersample down to target → refine.
    // This synthesises genuine crisp micro-texture instead of interpolating latents.
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
    // ESRGAN models output ~4×; scale the result to hiresFactor of the original.
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
    // ControlNet Tile conditions the refine on the upscaled image, so a higher
    // denoise redraws crisp texture while preserving the structure.
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
    // Fallback (no upscale model): latent upscale (bislerp) + higher-denoise refine.
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

  // Save
  workflow['save'] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: 'anthroposcenic', images: imageOut },
    _meta: { title: 'Save Image' },
  };

  return workflow;
}
