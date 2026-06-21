import { ComfyUIConfigOptions } from '@/types';
import { ConfigFormValues, isFluxCheckpoint } from '@/lib/config-form';

function applyModelSelectionDefaults(
  next: Partial<ConfigFormValues>,
  data: ComfyUIConfigOptions
): void {
  if (data.checkpoints.length > 0) {
    const flux = data.checkpoints.find(isFluxCheckpoint);
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
}

function applyFeatureToggleDefaults(
  next: Partial<ConfigFormValues>,
  defaults: ComfyUIConfigOptions['defaults']
): void {
  if (typeof defaults.hiresFix === 'boolean') next.hiresFix = defaults.hiresFix;
  if (typeof defaults.hiresFactor === 'number') next.hiresFactor = defaults.hiresFactor;
  if (typeof defaults.hiresDenoise === 'number') next.hiresDenoise = defaults.hiresDenoise;
  if (typeof defaults.controlNet === 'boolean') next.controlNet = defaults.controlNet;
  if (typeof defaults.controlNetStrength === 'number') {
    next.controlNetStrength = defaults.controlNetStrength;
  }
  if (typeof defaults.freeU === 'boolean') next.freeU = defaults.freeU;
  if (typeof defaults.qualityBoost === 'boolean') next.qualityBoost = defaults.qualityBoost;
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

  applyModelSelectionDefaults(next, data);
  applyFeatureToggleDefaults(next, data.defaults || {});

  return next;
}
