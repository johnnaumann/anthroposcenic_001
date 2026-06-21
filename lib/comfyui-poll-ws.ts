import { ComfyUIProgressUpdate } from '@/types';
import {
  completePollUpdate,
  findFilesystemOutputUrl,
  retryFindOutputUrl,
} from '@/lib/comfyui-poll-output';

/**
 * Stream WebSocket progress and attempt output resolution when the workflow completes.
 * Yields progress updates; returns true if the job completed with an image URL.
 */
export async function* pollComfyUIJobViaWebSocket(
  promptId: string,
  jobStartTime: number
): AsyncGenerator<ComfyUIProgressUpdate, boolean, unknown> {
  try {
    const { streamComfyUIProgress } = await import('./comfyui-ws');
    let wsCompleted = false;
    let lastProgress = 0;

    for await (const update of streamComfyUIProgress(promptId)) {
      if (update.status === 'error') {
        yield update;
        return true;
      }
      if (update.status === 'timeout') {
        break;
      }

      yield update;

      if (update.progress !== undefined) {
        lastProgress = update.progress;
      }

      if (update.executionComplete) {
        wsCompleted = true;
        console.log(`[Poll] WebSocket indicated workflow completion, checking for image immediately...`);

        const immediateUrl = await findFilesystemOutputUrl(promptId, jobStartTime);
        if (immediateUrl) {
          console.log(`✅ ComfyUI job ${promptId} completed - found image immediately! URL: ${immediateUrl}`);
          yield completePollUpdate(immediateUrl);
          return true;
        }
        console.log(`[Poll] Immediate filesystem check didn't find image, will retry after WebSocket closes...`);
      }
    }

    if (lastProgress >= 95 || wsCompleted) {
      console.log(
        `[Poll] WebSocket stream ended (progress: ${lastProgress}%, completed: ${wsCompleted}), checking for output image...`
      );

      const postWebSocketUrl = await retryFindOutputUrl(promptId, jobStartTime, {
        maxAttempts: 6,
        checkHistoryEveryOther: true,
        logPrefix: '[Poll]',
      });
      if (postWebSocketUrl) {
        console.log(`✅ ComfyUI job ${promptId} completed! URL: ${postWebSocketUrl}`);
        yield completePollUpdate(postWebSocketUrl);
        return true;
      }

      console.log(`[Poll] Image not found after ${6} attempts, falling through to HTTP polling...`);
    }
  } catch (error) {
    console.warn('WebSocket connection failed, falling back to HTTP polling:', error);
  }

  return false;
}
