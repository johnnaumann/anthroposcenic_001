const DESCRIPTION_KEY = 'anthroposcenic:description';

export function savePipelineDescription(description: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DESCRIPTION_KEY, description);
}

export function loadPipelineDescription(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(DESCRIPTION_KEY);
}

export function clearPipelineDescription(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DESCRIPTION_KEY);
}
