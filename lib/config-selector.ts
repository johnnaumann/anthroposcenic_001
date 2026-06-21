import { ComfyUIConfig, ComfyUIConfigOptions } from '@/types';
import { DEFAULT_NEGATIVE_PROMPT } from '@/lib/comfyui-defaults';

export type FluxQuality = 'fast' | 'quality';

export type ConfigFormValues = Omit<ComfyUIConfig, 'description'> & {
  fluxQuality: FluxQuality;
};

export const INITIAL_CONFIG_FORM: ConfigFormValues = {
  checkpoint: '',
  sampler: 'dpmpp_2m',
  scheduler: 'karras',
  steps: 28,
  cfgScale: 7,
  denoiseStrength: 0.85,
  negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  hiresFix: true,
  hiresFactor: 1.5,
  hiresDenoise: 0.45,
  controlNet: false,
  controlNetStrength: 0.65,
  freeU: true,
  qualityBoost: true,
  fluxQuality: 'fast',
};

export function isFluxCheckpoint(checkpoint: string): boolean {
  return /flux|\.gguf$/i.test(checkpoint);
}

export function applyConfigDefaultsFromOptions(
  data: ComfyUIConfigOptions
): Partial<ConfigFormValues> {
  const next: Partial<ConfigFormValues> = {
    steps: data.defaults.steps,
    cfgScale: data.defaults.cfgScale,
    denoiseStrength: data.defaults.denoiseStrength,
    negativePrompt: data.defaults.negativePrompt,
  };

  if (data.checkpoints.length > 0) {
    const flux = data.checkpoints.find((cp) => /flux|\.gguf$/i.test(cp));
    const dream = data.checkpoints.find((cp) => cp.includes('DreamShaper'));
    next.checkpoint = flux || dream || data.checkpoints[0];
  }

  if (data.samplers.length > 0) {
    const preferredSampler = data.defaults?.sampler || 'dpmpp_2m';
    next.sampler = data.samplers.includes(preferredSampler) ? preferredSampler : data.samplers[0];
  }

  const preferredScheduler = data.defaults?.scheduler || 'karras';
  next.scheduler = data.schedulers?.includes(preferredScheduler)
    ? preferredScheduler
    : data.schedulers?.[0] || 'normal';

  const defaults = data.defaults || {};
  if (typeof defaults.hiresFix === 'boolean') next.hiresFix = defaults.hiresFix;
  if (typeof defaults.hiresFactor === 'number') next.hiresFactor = defaults.hiresFactor;
  if (typeof defaults.hiresDenoise === 'number') next.hiresDenoise = defaults.hiresDenoise;
  if (typeof defaults.controlNet === 'boolean') next.controlNet = defaults.controlNet;
  if (typeof defaults.controlNetStrength === 'number') {
    next.controlNetStrength = defaults.controlNetStrength;
  }
  if (typeof defaults.freeU === 'boolean') next.freeU = defaults.freeU;
  if (typeof defaults.qualityBoost === 'boolean') next.qualityBoost = defaults.qualityBoost;

  return next;
}

export function formatConfigSummary(values: ConfigFormValues): string {
  if (isFluxCheckpoint(values.checkpoint)) {
    return `Flux · ${values.fluxQuality === 'fast' ? 'fast · ~2 min' : 'slow · ~13 min'} · denoise ${values.denoiseStrength}`;
  }

  return `${values.checkpoint} · ${values.steps} steps · denoise ${values.denoiseStrength}${
    values.hiresFix ? ' · hi-res' : ''
  }`;
}

export function buildProcessConfig(
  description: string,
  values: ConfigFormValues,
  configOptions: ComfyUIConfigOptions | null
): { config: ComfyUIConfig } | { error: string } {
  if (!values.checkpoint || !values.sampler || !description.trim()) {
    return { error: 'Missing required configuration' };
  }

  let finalCheckpoint = values.checkpoint;
  let finalSteps = values.steps;

  if (values.checkpoint === 'Flux') {
    const flux = configOptions?.flux;
    const chosen =
      values.fluxQuality === 'fast' ? flux?.schnell || flux?.dev : flux?.dev || flux?.schnell;

    if (!chosen) {
      return { error: 'No Flux model is installed.' };
    }

    finalCheckpoint = chosen;
    finalSteps = values.fluxQuality === 'fast' ? 4 : 20;
  }

  return {
    config: {
      description,
      checkpoint: finalCheckpoint,
      sampler: values.sampler,
      scheduler: values.scheduler,
      steps: finalSteps,
      cfgScale: values.cfgScale,
      denoiseStrength: values.denoiseStrength,
      negativePrompt: values.negativePrompt,
      hiresFix: values.hiresFix,
      hiresFactor: values.hiresFactor,
      hiresDenoise: values.hiresDenoise,
      controlNet: values.controlNet,
      controlNetStrength: values.controlNetStrength,
      freeU: values.freeU,
      qualityBoost: values.qualityBoost,
    },
  };
}
