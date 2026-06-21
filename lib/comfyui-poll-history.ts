import { ComfyHistoryOutputs } from '@/lib/comfyui-helpers';
import { getAllComfyUIHistory } from '@/lib/comfyui-output';
import { getComfyUIHistory } from '@/lib/comfyui-poll-api';
import {
  findFilesystemOutputUrl,
  resolveHistoryOutputImageUrl,
  waitAndRecheckOutputUrl,
} from '@/lib/comfyui-poll-output';

export interface ComfyJobHistoryData {
  outputs?: ComfyHistoryOutputs;
  status?: {
    completed?: Array<{ outputs?: ComfyHistoryOutputs }>;
    messages?: Array<[string, unknown]>;
    node_errors?: Record<string, string[]>;
  };
}

export function assertNoJobHistoryErrors(promptId: string, jobData: ComfyJobHistoryData): void {
  if (jobData.status?.node_errors && Object.keys(jobData.status.node_errors).length > 0) {
    const errorMessages = Object.entries(jobData.status.node_errors)
      .map(([node, errors]) => `Node ${node}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
      .join('; ');
    console.error(`ComfyUI job ${promptId} has errors:`, JSON.stringify(jobData.status.node_errors, null, 2));
    throw new Error(`ComfyUI workflow errors: ${errorMessages}`);
  }

  const failureMsg = jobData.status?.messages?.find(
    (msg) =>
      Array.isArray(msg) && (msg[0] === 'execution_error' || msg[0] === 'execution_interrupted')
  );
  if (!failureMsg) {
    return;
  }

  console.error(`ComfyUI job ${promptId} failed:`, failureMsg);

  let errorMessage = `ComfyUI execution failed: ${JSON.stringify(failureMsg)}`;
  if (Array.isArray(failureMsg) && failureMsg.length > 1 && typeof failureMsg[1] === 'object') {
    const errorDetails = failureMsg[1] as {
      exception_message?: string;
      node_type?: string;
      ckpt_name?: string[];
    };
    if (errorDetails.exception_message) {
      errorMessage = errorDetails.exception_message;
      if (errorDetails.node_type) {
        errorMessage = `${errorDetails.node_type}: ${errorMessage}`;
      }
      if (errorDetails.ckpt_name && Array.isArray(errorDetails.ckpt_name) && errorDetails.ckpt_name.length > 0) {
        errorMessage = `Model ${errorDetails.ckpt_name[0]}: ${errorMessage}`;
      }
    }
  }

  throw new Error(errorMessage);
}

function jobHasSuccessMessage(jobData: ComfyJobHistoryData): boolean {
  return (
    jobData.status?.messages?.some(
      (msg) => Array.isArray(msg) && msg[0] === 'execution_success'
    ) ?? false
  );
}

export async function resolveOutputFromJobHistory(
  promptId: string,
  jobData: ComfyJobHistoryData,
  jobStartTime: number
): Promise<string | null | 'wait'> {
  const hasSuccessMessage = jobHasSuccessMessage(jobData);

  if (jobData.outputs) {
    console.log(`[HTTP Poll] Checking outputs for prompt ${promptId}:`, Object.keys(jobData.outputs));
    const outputUrl = resolveHistoryOutputImageUrl(jobData.outputs);
    if (outputUrl) {
      return outputUrl;
    }
    console.log(`[HTTP Poll] No images found in outputs for prompt ${promptId}`);

    console.log(`[HTTP Poll] Trying filesystem fallback for prompt ${promptId}...`);
    const filesystemUrl = await findFilesystemOutputUrl(promptId, jobStartTime);
    if (filesystemUrl) {
      return filesystemUrl;
    }

    if (hasSuccessMessage) {
      const recheckUrl = await waitAndRecheckOutputUrl(promptId, jobStartTime);
      if (recheckUrl) {
        return recheckUrl;
      }
    }

    console.warn(`Prompt ${promptId} found in history but no images in outputs or filesystem`);
    return null;
  }

  if (hasSuccessMessage) {
    console.log(`Job ${promptId} shows execution_success but outputs not ready, waiting...`);
    return 'wait';
  }

  console.warn(`Prompt ${promptId} found in history but no outputs field`);

  const completed = jobData.status?.completed?.[0];
  if (completed?.outputs) {
    return resolveHistoryOutputImageUrl(completed.outputs);
  }

  return null;
}

export async function fetchPollHistory(
  promptId: string,
  attempts: number,
  wasInQueue: boolean,
  isStillRunning: boolean,
  isPending: boolean
): Promise<{ [key: string]: unknown } | null> {
  let history = await getComfyUIHistory(promptId);

  if (!history) {
    const shouldCheckAllHistory =
      (wasInQueue && !isStillRunning && !isPending) ||
      (wasInQueue && attempts % 2 === 0) ||
      (!wasInQueue && attempts % 3 === 0);

    if (shouldCheckAllHistory) {
      const allHistory = await getAllComfyUIHistory();
      if (allHistory?.[promptId]) {
        history = { [promptId]: allHistory[promptId] };
        console.log(`✅ Found prompt ${promptId} in all history (attempt ${attempts})`);
      }
    }
  }

  if (wasInQueue && !isStillRunning && !isPending && !history) {
    console.log(`[HTTP Poll] Job left queue, checking all history directly...`);
    const allHistory = await getAllComfyUIHistory();
    if (allHistory?.[promptId]) {
      history = { [promptId]: allHistory[promptId] };
      console.log(`✅ Found prompt ${promptId} in all history after leaving queue`);
    }
  }

  return history;
}

export function estimateHttpPollProgress(
  attempts: number,
  isStillRunning: boolean,
  isPending: boolean,
  wasInQueue: boolean,
  queuePendingCount: number
): number {
  const queueRemaining = queuePendingCount + (isStillRunning ? 1 : 0);

  if (isStillRunning) {
    const progress = Math.min(95, 50 + Math.min(45, attempts * 0.1));
    console.log(`[HTTP Poll] Job running, estimated progress: ${progress}% (attempt ${attempts})`);
    return progress;
  }

  if (isPending) {
    const progress = Math.min(20, Math.max(0, 20 - queueRemaining * 5));
    console.log(`[HTTP Poll] Job pending in queue (${queueRemaining} remaining), progress: ${progress}%`);
    return progress;
  }

  if (wasInQueue) {
    console.log(`[HTTP Poll] Job left queue, estimated progress: 95%`);
    return 95;
  }

  const progress = Math.min(50, attempts * 0.2);
  console.log(`[HTTP Poll] No queue info, estimated progress: ${progress}% (attempt ${attempts})`);
  return progress;
}

export async function formatPollErrorMessage(error: unknown): Promise<string> {
  let errorMessage = error instanceof Error ? error.message : 'Unknown error';

  const { isCorruptionError } = await import('@/lib/model-downloader');
  if (!isCorruptionError(errorMessage)) {
    return errorMessage;
  }

  const modelMatch =
    errorMessage.match(/Model\s+([^\s:]+)/i) ||
    errorMessage.match(/ckpt_name.*?\[.*?['"]([^'"]+)['"]/i);
  const modelName = modelMatch ? modelMatch[1] : 'the model file';

  return (
    `Model file "${modelName}" appears to be corrupted. The error suggests the safetensors file is invalid or incomplete.\n\n` +
    `To fix this:\n` +
    `1. Delete the corrupted file: comfyui/models/checkpoints/${modelName}\n` +
    `2. The model will be automatically re-downloaded on the next attempt, or\n` +
    `3. Download manually from Hugging Face or Civitai`
  );
}
