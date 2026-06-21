/**
 * ComfyUI WebSocket client for real-time progress updates
 */

import WebSocket from 'ws';
import type { ComfyUIProgressUpdate } from '@/types';
import { handleComfyUIWebSocketMessage } from '@/lib/comfyui-ws-message';

const COMFYUI_WS_URL = process.env.COMFYUI_WS_URL || 'ws://localhost:8188/ws';

/**
 * Connect to ComfyUI WebSocket and listen for progress updates
 * Returns an async generator that yields progress updates in real-time
 */
export async function* streamComfyUIProgress(
  promptId: string,
  timeout: number = 600000
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

  const closeConnection = () => {
    if (!isClosed) {
      isClosed = true;
      clearTimeout(timeoutId);
      ws.close();
    }
  };

  ws.on('open', () => {
    console.log(`[WebSocket] Connected to ComfyUI for prompt ${promptId}`);
  });

  ws.on('message', (data: WebSocket.Data) => {
    handleComfyUIWebSocketMessage(data, {
      promptId,
      sendUpdate,
      markCompleted: () => {
        executionCompleted = true;
      },
      closeConnection,
    });
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
    if (pendingResolve) {
      pendingResolve(
        executionCompleted
          ? { status: 'processing', executionComplete: true }
          : { status: 'timeout' }
      );
    }
  });

  try {
    while (!isClosed || messageQueue.length > 0) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else {
        yield new Promise<ComfyUIProgressUpdate>((resolve) => {
          pendingResolve = resolve;
        });
      }
    }
  } finally {
    closeConnection();
  }
}
