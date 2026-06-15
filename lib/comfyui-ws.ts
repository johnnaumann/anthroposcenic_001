/**
 * ComfyUI WebSocket client for real-time progress updates
 */

import WebSocket from 'ws';
import type { ComfyUIProgressUpdate } from '@/types';

const COMFYUI_WS_URL = process.env.COMFYUI_WS_URL || 'ws://localhost:8188/ws';

export interface ComfyUIWebSocketMessage {
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
  prompt_id?: string; // Some messages have prompt_id at top level
  node?: string;
  value?: number; // Legacy format (deprecated)
  max?: number; // Legacy format (deprecated)
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
): AsyncGenerator<ComfyUIProgressUpdate, void, unknown> {
  const ws = new WebSocket(COMFYUI_WS_URL);
  const messageQueue: Array<ComfyUIProgressUpdate> = [];
  let isClosed = false;
  let executionCompleted = false;
  let pendingResolve: ((value: ComfyUIProgressUpdate) => void) | null = null;

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

  const sendUpdate = (update: ComfyUIProgressUpdate) => {
    if (pendingResolve) {
      pendingResolve(update);
      pendingResolve = null;
    } else {
      messageQueue.push(update);
    }
  };

  ws.on('open', () => {
    console.log(`[WebSocket] Connected to ComfyUI for prompt ${promptId}`);
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString()) as ComfyUIWebSocketMessage;
      
      // Debug: Log all message types (can be disabled in production)
      if (process.env.DEBUG_WS === 'true') {
        console.log(`[WebSocket] Received message type: ${message.type}`, JSON.stringify(message, null, 2));
      }
      
      // Handle progress updates first (they have prompt_id in data, not at top level)
      // ComfyUI sends progress as: { type: "progress", data: { value: 1, max: 20, prompt_id: "...", node: null } }
      if (message.type === 'progress') {
        const progressData = message.data;
        const current = progressData?.value ?? message.value ?? 0; // Support both formats
        const max = progressData?.max ?? message.max ?? 100; // Support both formats
        
        // Only process if this message is for our prompt (or if no prompt_id specified, assume it's for us)
        const messagePromptId = progressData?.prompt_id ?? message.prompt_id;
        if (messagePromptId && messagePromptId !== promptId) {
          if (process.env.DEBUG_WS === 'true') {
            console.log(`[WebSocket] Skipping progress for different prompt: ${messagePromptId} (expected: ${promptId})`);
          }
          return; // Skip messages for other prompts
        }
        
        // Calculate actual percentage (0-100%)
        const progress = max > 0 ? Math.floor((current / max) * 100) : 0;
        
        // Use actual progress value (no adjustment) to match terminal output
        console.log(`[WebSocket] Progress: ${current}/${max} = ${progress}% (node: ${progressData?.node || message.node || 'N/A'})`);
        sendUpdate({
          status: 'processing',
          progress,
          step: current,
          stepMax: max,
        });
      }
      
      // Handle progress_state messages (alternative format with node details)
      if (message.type === 'progress_state') {
        const progressData = message.data;
        if (progressData && typeof progressData === 'object') {
          // progress_state may contain node-level progress information
          // For now, we'll rely on 'progress' messages, but log this for debugging
          if (process.env.DEBUG_WS === 'true') {
            console.log(`[WebSocket] Received progress_state:`, JSON.stringify(progressData));
          }
        }
      }
      
      // Handle execution start
      if (message.type === 'execution_start') {
        const data = message.data as { prompt_id?: string } | undefined;
        if (!data || data.prompt_id === promptId) {
          console.log(`[WebSocket] Execution started for prompt ${promptId}`);
          sendUpdate({ status: 'processing', progress: 0 }); // Start at 0%, progress messages will update
        }
      }
      
      // Handle execution cached
      if (message.type === 'execution_cached') {
        const data = message.data as { prompt_id?: string } | undefined;
        if (!data || data.prompt_id === promptId) {
          console.log(`[WebSocket] Execution cached for prompt ${promptId}`);
          // Cached execution is fast, but still show progress from actual progress messages
          sendUpdate({ status: 'processing', progress: 0 });
        }
      }
      
      // Handle execution success
      if (message.type === 'execution_success') {
        const data = message.data as { prompt_id?: string } | undefined;
        if (!data || data.prompt_id === promptId) {
          executionCompleted = true;
          console.log(`[WebSocket] Execution success for prompt ${promptId} - job completed!`);
          sendUpdate({ status: 'processing', executionComplete: true });
          // Close after short delay to allow history/filesystem to populate
          setTimeout(() => {
            if (!isClosed) {
              isClosed = true;
              clearTimeout(timeoutId);
              ws.close();
            }
          }, 1000);
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
      
      // Handle status updates (queue information)
      if (message.type === 'status' && message.status) {
        const execInfo = message.status.exec_info;
        if (execInfo && execInfo.queue_remaining !== undefined) {
          const queueRemaining = execInfo.queue_remaining;
          // Show queue position as progress (0-10% range for queue waiting)
          const queueProgress = Math.max(0, Math.min(10, 10 - (queueRemaining * 2)));
          console.log(`[WebSocket] Queue remaining: ${queueRemaining}, progress: ${queueProgress}%`);
          sendUpdate({ status: 'processing', progress: queueProgress });
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
    if (!isClosed) {
      isClosed = true;
      clearTimeout(timeoutId);
      sendUpdate({ status: 'error', error: `WebSocket error: ${error.message}` });
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Closed for prompt ${promptId}`);
    if (!isClosed) {
      isClosed = true;
      clearTimeout(timeoutId);
    }
    if (pendingResolve && executionCompleted) {
      pendingResolve({ status: 'processing', executionComplete: true });
    }
  });

  try {
    while (!isClosed || messageQueue.length > 0) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else {
        // Wait for next message
        yield new Promise<ComfyUIProgressUpdate>((resolve) => {
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
