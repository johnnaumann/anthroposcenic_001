import { ComfyUIConfig } from '@/types';

export type ProcessStreamEvent =
  | { type: 'status'; data: string }
  | { type: 'progress'; data: unknown }
  | { type: 'image'; data: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

type Listener = (event: ProcessStreamEvent) => void;

interface ActiveRun {
  listeners: Set<Listener>;
  abortController: AbortController;
}

const activeRuns = new Map<string, ActiveRun>();

function emit(run: ActiveRun, event: ProcessStreamEvent) {
  run.listeners.forEach((listener) => {
    listener(event);
  });
}

async function startRun(
  key: string,
  body: {
    imageId: string;
    config: ComfyUIConfig;
    useImage: boolean;
    width: number;
    height: number;
  },
  run: ActiveRun
) {
  try {
    const response = await fetch('/api/comfyui/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: run.abortController.signal,
    });

    if (!response.ok) {
      throw new Error('Failed to start ComfyUI processing');
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'status' && data.data) {
            emit(run, { type: 'status', data: String(data.data) });
          } else if (data.type === 'progress') {
            emit(run, { type: 'progress', data: data.data });
          } else if (data.type === 'image' && data.data) {
            emit(run, { type: 'image', data: data.data });
            return;
          } else if (data.type === 'done') {
            emit(run, { type: 'done' });
            return;
          } else if (data.type === 'error') {
            throw new Error(data.error || 'Unknown error');
          }
        } catch (error) {
          if (error instanceof SyntaxError) {
            console.warn('[ComfyUIProcessStream] Failed to parse message:', line, error);
          } else {
            throw error;
          }
        }
      }
    }

    throw new Error('Processing ended before an image was returned');
  } catch (error) {
    if (run.abortController.signal.aborted) {
      return;
    }

    emit(run, {
      type: 'error',
      error: error instanceof Error ? error.message : 'Processing failed',
    });
  } finally {
    const current = activeRuns.get(key);
    if (current === run) {
      activeRuns.delete(key);
    }
  }
}

export function subscribeComfyUIProcess(
  key: string,
  body: {
    imageId: string;
    config: ComfyUIConfig;
    useImage: boolean;
    width: number;
    height: number;
  },
  listener: Listener
): () => void {
  let run = activeRuns.get(key);

  if (!run) {
    run = {
      listeners: new Set(),
      abortController: new AbortController(),
    };
    activeRuns.set(key, run);
    void startRun(key, body, run);
  }

  run.listeners.add(listener);

  return () => {
    run!.listeners.delete(listener);

    if (run!.listeners.size === 0) {
      window.setTimeout(() => {
        const current = activeRuns.get(key);
        if (current === run && current.listeners.size === 0) {
          current.abortController.abort();
          activeRuns.delete(key);
        }
      }, 250);
    }
  };
}

export function abortComfyUIProcess(key: string) {
  const run = activeRuns.get(key);
  if (!run) return;

  run.abortController.abort();
  activeRuns.delete(key);
}
