import { ComfyUIStatus } from '@/types';
import { COMFYUI_HOST } from '@/lib/comfyui-helpers';

export async function getComfyUIQueueStatus(): Promise<ComfyUIStatus> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/queue`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`ComfyUI API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('ECONNREFUSED'))) {
      console.error(`Network error connecting to ComfyUI at ${COMFYUI_HOST}:`, error);
      throw new Error(`Network error connecting to ComfyUI at ${COMFYUI_HOST}. Is ComfyUI running?`);
    }
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      console.error(`Timeout connecting to ComfyUI at ${COMFYUI_HOST}:`, error);
      throw new Error(`Timeout: ComfyUI at ${COMFYUI_HOST} did not respond within 5 seconds`);
    }
    throw error;
  }
}

export async function getComfyUIHistory(
  promptId: string
): Promise<{ [key: string]: unknown } | null> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/history/${promptId}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && (data[promptId] || Object.keys(data).length > 0)) {
        return data;
      }
    }

    const allHistoryResponse = await fetch(`${COMFYUI_HOST}/history`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!allHistoryResponse.ok) {
      return null;
    }

    const allHistory = await allHistoryResponse.json();
    if (allHistory && allHistory[promptId]) {
      return { [promptId]: allHistory[promptId] };
    }

    return null;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`Network error connecting to ComfyUI at ${COMFYUI_HOST}:`, error);
    } else {
      console.error('Failed to get ComfyUI history:', error);
    }
    return null;
  }
}

export function isPromptInQueue(items: unknown[], promptId: string): boolean {
  return items.some(
    (item: unknown) => Array.isArray(item) && item.length > 1 && item[1] === promptId
  );
}
