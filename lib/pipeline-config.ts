import { ComfyUIConfig } from '@/types';

const CONFIG_KEY = 'anthroposcenic:config';

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
