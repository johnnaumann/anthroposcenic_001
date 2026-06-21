import { ComfyUIProgressUpdate } from '@/types';
import { getAllComfyUIHistory } from '@/lib/comfyui-output';
import { getComfyUIQueueStatus, isPromptInQueue } from '@/lib/comfyui-poll-api';
import {
  assertNoJobHistoryErrors,
  ComfyJobHistoryData,
  estimateHttpPollProgress,
  fetchPollHistory,
  formatPollErrorMessage,
  resolveOutputFromJobHistory,
} from '@/lib/comfyui-poll-history';
import { completePollUpdate, findFilesystemOutputUrl } from '@/lib/comfyui-poll-output';

export async function* pollComfyUIJobViaHttp(
  promptId: string,
  jobStartTime: number,
  maxAttempts: number,
  intervalMs: number
): AsyncGenerator<ComfyUIProgressUpdate, void, unknown> {
  let attempts = 0;
  let wasInQueue = false;

  while (attempts < maxAttempts) {
    try {
      const queueStatus = await getComfyUIQueueStatus();
      const queueRunning = queueStatus.queue_running || [];
      const queuePending = queueStatus.queue_pending || [];
      const isStillRunning = isPromptInQueue(queueRunning, promptId);
      const isPending = isPromptInQueue(queuePending, promptId);

      if (isStillRunning || isPending) {
        wasInQueue = true;
      }

      let history = await fetchPollHistory(
        promptId,
        attempts,
        wasInQueue,
        isStillRunning,
        isPending
      );

      if (history?.[promptId]) {
        const jobData = history[promptId] as ComfyJobHistoryData;
        assertNoJobHistoryErrors(promptId, jobData);

        const output = await resolveOutputFromJobHistory(promptId, jobData, jobStartTime);
        if (output === 'wait') {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        if (output) {
          console.log(`✅ ComfyUI job ${promptId} completed! URL: ${output}`);
          yield completePollUpdate(output);
          return;
        }
      }

      if (wasInQueue && !isStillRunning && !isPending && !history) {
        const allHistory = await getAllComfyUIHistory();
        if (allHistory?.[promptId]) {
          history = { [promptId]: allHistory[promptId] };
          console.log(`Found prompt ${promptId} in all history after leaving queue`);
        } else if (attempts < maxAttempts - 10) {
          console.log(`Job ${promptId} left queue but not in history yet, waiting... (attempt ${attempts})`);
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
          attempts++;
          continue;
        }
      }

      const progress = estimateHttpPollProgress(
        attempts,
        isStillRunning,
        isPending,
        wasInQueue,
        queuePending.length
      );
      yield { status: 'processing', progress };

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error) {
      console.error('Error polling ComfyUI job:', error);
      yield { status: 'error', error: await formatPollErrorMessage(error) };
      return;
    }
  }

  console.log(`[Poll] Job ${promptId} timed out, doing final filesystem check...`);
  const finalUrl = await findFilesystemOutputUrl(promptId, jobStartTime);
  if (finalUrl) {
    console.log(`✅ ComfyUI job ${promptId} found via final filesystem check! URL: ${finalUrl}`);
    yield completePollUpdate(finalUrl);
    return;
  }

  console.warn(`ComfyUI job ${promptId} timed out after ${maxAttempts} attempts`);
  yield { status: 'timeout' };
}
