import WebSocket from 'ws';
import type { ComfyUIProgressUpdate } from '@/types';

interface ComfyUIWebSocketMessage {
  type: string;
  data?: {
    value?: number;
    max?: number;
    prompt_id?: string;
    node?: string | null;
    error?: {
      message?: string;
      node?: number;
    };
    [key: string]: unknown;
  };
  prompt_id?: string;
  node?: string;
  value?: number;
  max?: number;
  status?: {
    status?: Array<[string, unknown]>;
    exec_info?: {
      queue_remaining?: number;
    };
  };
}

interface WebSocketMessageContext {
  promptId: string;
  sendUpdate: (update: ComfyUIProgressUpdate) => void;
  markCompleted: () => void;
  closeConnection: () => void;
}

function isForPrompt(messagePromptId: string | undefined, promptId: string): boolean {
  return !messagePromptId || messagePromptId === promptId;
}

function handleProgressMessage(
  message: ComfyUIWebSocketMessage,
  promptId: string,
  sendUpdate: (update: ComfyUIProgressUpdate) => void
): void {
  const progressData = message.data;
  const current = progressData?.value ?? message.value ?? 0;
  const max = progressData?.max ?? message.max ?? 100;
  const messagePromptId = progressData?.prompt_id ?? message.prompt_id;

  if (messagePromptId && messagePromptId !== promptId) {
    if (process.env.DEBUG_WS === 'true') {
      console.log(
        `[WebSocket] Skipping progress for different prompt: ${messagePromptId} (expected: ${promptId})`
      );
    }
    return;
  }

  const progress = max > 0 ? Math.floor((current / max) * 100) : 0;
  console.log(
    `[WebSocket] Progress: ${current}/${max} = ${progress}% (node: ${progressData?.node || message.node || 'N/A'})`
  );
  sendUpdate({
    status: 'processing',
    progress,
    step: current,
    stepMax: max,
  });
}

export function handleComfyUIWebSocketMessage(
  raw: WebSocket.Data,
  ctx: WebSocketMessageContext
): void {
  try {
    const message = JSON.parse(raw.toString()) as ComfyUIWebSocketMessage;

    if (process.env.DEBUG_WS === 'true') {
      console.log(`[WebSocket] Received message type: ${message.type}`, JSON.stringify(message, null, 2));
    }

    if (message.type === 'progress') {
      handleProgressMessage(message, ctx.promptId, ctx.sendUpdate);
      return;
    }

    if (message.type === 'progress_state' && process.env.DEBUG_WS === 'true') {
      console.log(`[WebSocket] Received progress_state:`, JSON.stringify(message.data));
      return;
    }

    if (message.type === 'execution_start') {
      const data = message.data as { prompt_id?: string } | undefined;
      if (isForPrompt(data?.prompt_id, ctx.promptId)) {
        console.log(`[WebSocket] Execution started for prompt ${ctx.promptId}`);
        ctx.sendUpdate({ status: 'processing', progress: 0 });
      }
      return;
    }

    if (message.type === 'execution_cached') {
      const data = message.data as { prompt_id?: string } | undefined;
      if (isForPrompt(data?.prompt_id, ctx.promptId)) {
        console.log(`[WebSocket] Execution cached for prompt ${ctx.promptId}`);
        ctx.sendUpdate({ status: 'processing', progress: 0 });
      }
      return;
    }

    if (message.type === 'execution_success') {
      const data = message.data as { prompt_id?: string } | undefined;
      if (isForPrompt(data?.prompt_id, ctx.promptId)) {
        ctx.markCompleted();
        console.log(`[WebSocket] Execution success for prompt ${ctx.promptId} - job completed!`);
        ctx.sendUpdate({ status: 'processing', executionComplete: true });
        setTimeout(ctx.closeConnection, 1000);
      }
      return;
    }

    if (message.type === 'execution_error') {
      const data = message.data as {
        prompt_id?: string;
        error?: { message?: string; node?: number };
      } | undefined;
      if (isForPrompt(data?.prompt_id, ctx.promptId)) {
        const errorMsg = data?.error?.message || 'Execution error';
        console.error(`Execution error for prompt ${ctx.promptId}:`, errorMsg);
        ctx.closeConnection();
        ctx.sendUpdate({ status: 'error', error: errorMsg });
      }
      return;
    }

    if (message.type === 'status' && message.status?.exec_info?.queue_remaining !== undefined) {
      const queueRemaining = message.status.exec_info.queue_remaining;
      const queueProgress = Math.max(0, Math.min(10, 10 - queueRemaining * 2));
      console.log(`[WebSocket] Queue remaining: ${queueRemaining}, progress: ${queueProgress}%`);
      ctx.sendUpdate({ status: 'processing', progress: queueProgress });
    }
  } catch (error) {
    console.error('Error parsing WebSocket message:', error);
  }
}
