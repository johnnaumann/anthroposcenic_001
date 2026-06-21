import { ComfyUIProgressUpdate } from '@/types';
import { pollComfyUIJobViaHttp } from '@/lib/comfyui-poll-http';
import { pollComfyUIJobViaWebSocket } from '@/lib/comfyui-poll-ws';

/**
 * Poll ComfyUI job status and get results.
 * Uses WebSocket for real-time progress, falls back to HTTP polling for final image detection.
 */
export async function* pollComfyUIJob(
  promptId: string,
  maxAttempts: number = 300,
  intervalMs: number = 2000,
  useWebSocket: boolean = true
): AsyncGenerator<ComfyUIProgressUpdate, void, unknown> {
  const jobStartTime = Date.now();

  if (useWebSocket) {
    const wsDone = yield* pollComfyUIJobViaWebSocket(promptId, jobStartTime);
    if (wsDone) {
      return;
    }
  }

  yield* pollComfyUIJobViaHttp(promptId, jobStartTime, maxAttempts, intervalMs);
}
