/**
 * ComfyUI WebSocket client for real-time progress updates
 */

import WebSocket from 'ws';

const COMFYUI_WS_URL = process.env.COMFYUI_WS_URL || 'ws://localhost:8188/ws';

export interface ComfyUIWebSocketMessage {
  type: string;
  data?: unknown;
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

/**
 * Connect to ComfyUI WebSocket and listen for progress updates
 * Returns an async generator that yields progress updates in real-time
 */
export async function* streamComfyUIProgress(
  promptId: string,
  timeout: number = 600000 // 10 minutes
): AsyncGenerator<{ status: string; progress?: number; imageUrl?: string; error?: string }, void, unknown> {
  const ws = new WebSocket(COMFYUI_WS_URL);
  const messageQueue: Array<{ status: string; progress?: number; imageUrl?: string; error?: string }> = [];
  let isClosed = false;
  let executionCompleted = false;
  let pendingResolve: ((value: { status: string; progress?: number; imageUrl?: string; error?: string }) => void) | null = null;

  const timeoutId = setTimeout(() => {
    if (!isClosed) {
      isClosed = true;
      ws.close();
      messageQueue.push({ status: 'timeout', error: 'WebSocket connection timed out' });
      if (pendingResolve) {
        pendingResolve(messageQueue.shift()!);
      }
    }
  }, timeout);

  const sendUpdate = (update: { status: string; progress?: number; imageUrl?: string; error?: string }) => {
    if (pendingResolve) {
      pendingResolve(update);
      pendingResolve = null;
    } else {
      messageQueue.push(update);
    }
  };

  ws.on('open', () => {
    console.log(`WebSocket connected to ComfyUI for prompt ${promptId}`);
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString()) as ComfyUIWebSocketMessage;
      
      // Filter messages for our prompt ID if present
      if (message.prompt_id && message.prompt_id !== promptId) {
        return; // Skip messages for other prompts
      }
      
      // Handle progress updates
      if (message.type === 'progress') {
        const current = message.value || 0;
        const max = message.max || 100;
        const progress = Math.floor((current / max) * 100);
        
        // Yield progress update (10-90% during processing)
        const adjustedProgress = Math.max(10, Math.min(90, 10 + Math.floor((progress / 100) * 80)));
        sendUpdate({ status: 'processing', progress: adjustedProgress });
      }
      
      // Handle execution start
      if (message.type === 'execution_start') {
        const data = message.data as { prompt_id?: string } | undefined;
        if (!data || data.prompt_id === promptId) {
          console.log(`Execution started for prompt ${promptId}`);
          sendUpdate({ status: 'processing', progress: 10 });
        }
      }
      
      // Handle execution cached
      if (message.type === 'execution_cached') {
        const data = message.data as { prompt_id?: string } | undefined;
        if (!data || data.prompt_id === promptId) {
          console.log(`Execution cached for prompt ${promptId}`);
          sendUpdate({ status: 'processing', progress: 20 });
        }
      }
      
      // Handle execution success
      if (message.type === 'execution_success') {
        const data = message.data as { prompt_id?: string } | undefined;
        if (!data || data.prompt_id === promptId) {
          executionCompleted = true;
          console.log(`Execution success for prompt ${promptId}`);
          sendUpdate({ status: 'processing', progress: 99 });
          // Close after short delay to allow history to populate
          setTimeout(() => {
            if (!isClosed) {
              isClosed = true;
              clearTimeout(timeoutId);
              ws.close();
              if (pendingResolve) {
                pendingResolve({ status: 'processing', progress: 99 });
              }
            }
          }, 2000);
        }
      }
      
      // Handle execution error
      if (message.type === 'execution_error') {
        const data = message.data as { prompt_id?: string; error?: { message?: string; node?: number } } | undefined;
        if (!data || (data.prompt_id && data.prompt_id === promptId)) {
          const errorMsg = data?.error?.message || 'Execution error';
          console.error(`Execution error for prompt ${promptId}:`, errorMsg);
          if (!isClosed) {
            isClosed = true;
            clearTimeout(timeoutId);
            ws.close();
            sendUpdate({ status: 'error', error: errorMsg });
          }
        }
      }
      
      // Handle status updates
      if (message.type === 'status' && message.status) {
        const execInfo = message.status.exec_info;
        if (execInfo && execInfo.queue_remaining !== undefined) {
          const queueRemaining = execInfo.queue_remaining;
          const queueProgress = Math.max(5, Math.min(90, 100 - (queueRemaining * 10)));
          sendUpdate({ status: 'processing', progress: queueProgress });
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (!isClosed) {
      isClosed = true;
      clearTimeout(timeoutId);
      sendUpdate({ status: 'error', error: `WebSocket error: ${error.message}` });
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket closed for prompt ${promptId}`);
    if (!isClosed) {
      isClosed = true;
      clearTimeout(timeoutId);
    }
    if (pendingResolve && !executionCompleted) {
      pendingResolve({ status: 'processing', progress: 99 });
    }
  });

  try {
    while (!isClosed || messageQueue.length > 0) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else {
        // Wait for next message
        yield new Promise<{ status: string; progress?: number; imageUrl?: string; error?: string }>((resolve) => {
          pendingResolve = resolve;
        });
      }
    }
  } finally {
    if (!isClosed) {
      isClosed = true;
      clearTimeout(timeoutId);
      ws.close();
    }
  }
}
