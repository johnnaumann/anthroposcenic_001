import { ComfyUIConfig } from '@/types';

const DESCRIPTION_KEY = 'anthroposcenic:description';
const CONFIG_KEY = 'anthroposcenic:config';

export function savePipelineDescription(description: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DESCRIPTION_KEY, description);
}

export function loadPipelineDescription(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(DESCRIPTION_KEY);
}

export function savePipelineConfig(config: ComfyUIConfig): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadPipelineConfig(): ComfyUIConfig | null {
  if (typeof window === 'undefined') return null;

  const raw = sessionStorage.getItem(CONFIG_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ComfyUIConfig;
  } catch {
    return null;
  }
}

export function clearPipelineConfig(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CONFIG_KEY);
}

export function clearPipelineState(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DESCRIPTION_KEY);
  sessionStorage.removeItem(CONFIG_KEY);
}

export function parsePipelineConfigParam(configParam: string): ComfyUIConfig | null {
  try {
    return JSON.parse(decodeURIComponent(configParam)) as ComfyUIConfig;
  } catch {
    return null;
  }
}
