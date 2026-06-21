import { ComfyUIConfig, ComfyUIConfigOptions } from '@/types';
import { ConfigFormValues, isFluxCheckpoint } from '@/lib/config-form';

function resolveFluxCheckpoint(
  values: ConfigFormValues,
  configOptions: ComfyUIConfigOptions | null
): { checkpoint: string; steps: number } | { error: string } {
  const flux = configOptions?.flux;
  const chosen =
    values.fluxQuality === 'fast' ? flux?.schnell || flux?.dev : flux?.dev || flux?.schnell;

  if (!chosen) {
    return { error: 'No Flux model is installed.' };
  }

  return {
    checkpoint: chosen,
    steps: values.fluxQuality === 'fast' ? 4 : 20,
  };
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
    const resolved = resolveFluxCheckpoint(values, configOptions);
    if ('error' in resolved) {
      return { error: resolved.error };
    }
    finalCheckpoint = resolved.checkpoint;
    finalSteps = resolved.steps;
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
