import {
  buildOutputImagePath,
  ComfyHistoryOutputs,
  findFirstHistoryOutputImage,
} from '@/lib/comfyui-helpers';
import { findLatestOutputImage, getAllComfyUIHistory, getComfyUIOutputImage } from '@/lib/comfyui-output';

export type PollCompleteUpdate = {
  status: 'complete';
  progress: 100;
  imageUrl: string;
};

export function completePollUpdate(imageUrl: string): PollCompleteUpdate {
  return { status: 'complete', progress: 100, imageUrl };
}

export function resolveHistoryOutputImageUrl(outputs: ComfyHistoryOutputs): string | null {
  const image = findFirstHistoryOutputImage(outputs);
  if (!image) {
    return null;
  }

  return getComfyUIOutputImage(buildOutputImagePath(image));
}

export async function findFilesystemOutputUrl(
  promptId: string,
  jobStartTime: number
): Promise<string | null> {
  const result = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
  return result?.imageUrl ?? null;
}

async function findAllHistoryOutputUrl(
  promptId: string
): Promise<{ url: string | null; foundJob: boolean }> {
  const history = await getAllComfyUIHistory();
  if (!history?.[promptId]) {
    return { url: null, foundJob: false };
  }

  const outputs = (history[promptId] as { outputs?: ComfyHistoryOutputs }).outputs;
  if (!outputs) {
    return { url: null, foundJob: true };
  }

  return { url: resolveHistoryOutputImageUrl(outputs), foundJob: true };
}

export async function retryFindOutputUrl(
  promptId: string,
  jobStartTime: number,
  options: { maxAttempts: number; checkHistoryEveryOther: boolean; logPrefix: string }
): Promise<string | null> {
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    const delay = attempt === 0 ? 500 : 1000 * attempt;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    console.log(
      `${options.logPrefix} Filesystem check attempt ${attempt + 1}/${options.maxAttempts} for prompt ${promptId} (after ${delay}ms delay)...`
    );

    const filesystemUrl = await findFilesystemOutputUrl(promptId, jobStartTime);
    if (filesystemUrl) {
      return filesystemUrl;
    }

    if (options.checkHistoryEveryOther && attempt % 2 === 1) {
      console.log(`${options.logPrefix} Checking history API for prompt ${promptId}...`);
      const { url, foundJob } = await findAllHistoryOutputUrl(promptId);
      if (url) {
        return url;
      }

      if (foundJob) {
        console.log(`${options.logPrefix} History found but no images in outputs`);
      } else {
        console.log(`${options.logPrefix} Job ${promptId} not found in history yet`);
      }
    }
  }

  return null;
}

export async function waitAndRecheckOutputUrl(
  promptId: string,
  jobStartTime: number
): Promise<string | null> {
  console.log(`Job ${promptId} shows execution_success but no images yet, waiting...`);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const { url } = await findAllHistoryOutputUrl(promptId);
  if (url) {
    return url;
  }

  return findFilesystemOutputUrl(promptId, jobStartTime);
}
