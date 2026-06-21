import { ComfyUIWorkflow } from '@/lib/comfyui-workflow-types';

export interface SdHiresRefineParams {
  seed: number;
  hiresSteps: number;
  cfgScale: number;
  sampler: string;
  scheduler: string;
  hiresDenoise: number;
  hiresFactor: number;
  upscaleModel: string | null;
  useHires: boolean;
  useTileRefine: boolean;
  tileModel: string | null;
  controlNetStrength: number;
  modelSrc: [string, number];
  vae: [string, number];
}

/**
 * Append hi-res refine nodes after the base decode pass.
 * Returns the final image output node reference (base decode or hires decode).
 */
export function appendSdHiresRefine(
  workflow: ComfyUIWorkflow,
  params: SdHiresRefineParams,
  baseDecode: [string, number]
): [string, number] {
  const {
    seed,
    hiresSteps,
    cfgScale,
    sampler,
    scheduler,
    hiresDenoise,
    hiresFactor,
    upscaleModel,
    useHires,
    useTileRefine,
    tileModel,
    controlNetStrength,
    modelSrc,
    vae,
  } = params;

  if (!useHires) {
    return baseDecode;
  }

  if (upscaleModel) {
    workflow['upscale_model'] = {
      class_type: 'UpscaleModelLoader',
      inputs: { model_name: upscaleModel },
      _meta: { title: 'Load Upscale Model' },
    };
    workflow['upscale'] = {
      class_type: 'ImageUpscaleWithModel',
      inputs: { upscale_model: ['upscale_model', 0], image: baseDecode },
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
    return ['decode_hires', 0];
  }

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
  return ['decode_hires', 0];
}
