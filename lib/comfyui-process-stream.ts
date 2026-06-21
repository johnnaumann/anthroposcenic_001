import { ComfyUIConfig } from '@/types';
import { readFetchSSEStream } from '@/lib/streaming';

type ProcessStreamEvent =
  | { type: 'status'; data: string }
  | { type: 'meta'; data: { promptId: string; jobStartTime: number } }
  | { type: 'progress'; data: unknown }
  | { type: 'image'; data: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

type Listener = (event: ProcessStreamEvent) => void;

interface StreamState {
  completed: boolean;
  promptId: string | null;
  jobStartTime: number | null;
}

interface ActiveRun {
  listeners: Set<Listener>;
  abortController: AbortController;
  terminalEvent?: ProcessStreamEvent;
}

const activeRuns = new Map<string, ActiveRun>();

function emit(run: ActiveRun, event: ProcessStreamEvent) {
  run.listeners.forEach((listener) => {
    listener(event);
  });
}

function finishRun(run: ActiveRun, event: ProcessStreamEvent) {
  run.terminalEvent = event;
  emit(run, event);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function recoverProcessResult(
  promptId: string,
  jobStartTime: number,
  signal: AbortSignal
): Promise<string | null> {
  for (let attempt = 0; attempt < 45; attempt++) {
    if (signal.aborted) return null;
    if (attempt > 0) {
      await sleep(1000);
    }

    try {
      const params = new URLSearchParams({
        promptId,
        since: String(jobStartTime),
      });
      const response = await fetch(`/api/comfyui/process/result?${params}`, { signal });
      if (response.ok) {
        const data = (await response.json()) as { imageUrl?: string };
        if (data.imageUrl) {
          return data.imageUrl;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
    }
  }

  return null;
}

function parseStreamPayload(run: ActiveRun, state: StreamState, payload: string) {
  if (!payload.startsWith('data: ')) return;

  try {
    const data = JSON.parse(payload.slice(6));

    if (data.type === 'meta' && data.data?.promptId) {
      const resolvedPromptId = String(data.data.promptId);
      const resolvedJobStartTime =
        typeof data.data.jobStartTime === 'number'
          ? data.data.jobStartTime
          : Date.now();
      state.promptId = resolvedPromptId;
      state.jobStartTime = resolvedJobStartTime;
      emit(run, {
        type: 'meta',
        data: { promptId: resolvedPromptId, jobStartTime: resolvedJobStartTime },
      });
    } else if (data.type === 'status' && data.data) {
      emit(run, { type: 'status', data: String(data.data) });
    } else if (data.type === 'progress') {
      emit(run, { type: 'progress', data: data.data });
    } else if (data.type === 'image' && data.data) {
      state.completed = true;
      finishRun(run, { type: 'image', data: data.data });
    } else if (data.type === 'done') {
      emit(run, { type: 'done' });
    } else if (data.type === 'error') {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn('[ComfyUIProcessStream] Failed to parse message:', payload, error);
    } else {
      throw error;
    }
  }
}

async function tryRecoverImage(
  run: ActiveRun,
  state: StreamState
): Promise<boolean> {
  if (state.completed || !state.promptId || state.jobStartTime === null) {
    return false;
  }

  const recovered = await recoverProcessResult(
    state.promptId,
    state.jobStartTime,
    run.abortController.signal
  );

  if (!recovered) {
    return false;
  }

  state.completed = true;
  finishRun(run, { type: 'image', data: recovered });
  return true;
}

async function startRun(
  key: string,
  body: {
    imageId: string | null;
    config: ComfyUIConfig;
    useImage: boolean;
    width: number;
    height: number;
  },
  run: ActiveRun
) {
  const state: StreamState = {
    completed: false,
    promptId: null,
    jobStartTime: null,
  };

  try {
    const response = await fetch('/api/comfyui/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: run.abortController.signal,
    });

    await readFetchSSEStream(response, {
      errorMessage: 'Failed to start ComfyUI processing',
      onLine: (line) => {
        parseStreamPayload(run, state, line);
        return state.completed ? true : undefined;
      },
      shouldStop: () => state.completed,
    });

    if (state.completed) return;

    if (await tryRecoverImage(run, state)) {
      return;
    }

    throw new Error('Processing ended before an image was returned');
  } catch (error) {
    if (run.abortController.signal.aborted) {
      return;
    }

    if (await tryRecoverImage(run, state)) {
      return;
    }

    finishRun(run, {
      type: 'error',
      error: error instanceof Error ? error.message : 'Processing failed',
    });
  } finally {
    window.setTimeout(() => {
      const current = activeRuns.get(key);
      if (current === run) {
        activeRuns.delete(key);
      }
    }, 60_000);
  }
}

export function subscribeComfyUIProcess(
  key: string,
  body: {
    imageId: string | null;
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

  if (run.terminalEvent) {
    listener(run.terminalEvent);
  }

  return () => {
    run!.listeners.delete(listener);
  };
}

export function abortComfyUIProcess(key: string) {
  const run = activeRuns.get(key);
  if (!run) return;

  run.abortController.abort();
  activeRuns.delete(key);
}
