import { ComfyUIConfig } from '@/types';
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
