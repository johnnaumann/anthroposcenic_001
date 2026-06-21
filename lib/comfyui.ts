import { ComfyUIStatus } from '@/types';
import { DEFAULT_NEGATIVE_PROMPT } from '@/lib/comfyui-defaults';
import {
  buildOutputImagePath,
  ComfyHistoryOutputs,
  COMFYUI_HOST,
  findFirstHistoryOutputImage,
} from '@/lib/comfyui-helpers';
import { ComfyUIWorkflow } from '@/lib/comfyui-workflow';
import { readFile } from 'fs/promises';
import { join } from 'path';

export type { ComfyUIWorkflow } from '@/lib/comfyui-workflow';
export { createComfyUIWorkflow, isFluxModel } from '@/lib/comfyui-workflow';
export { getAvailableSamplers } from '@/lib/comfyui-helpers';

export interface ComfyUIQueueResponse {
  prompt_id: string;
  number: number;
}

/**
 * Check if ComfyUI service is available
 */
export async function checkComfyUIAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/system_stats`, {
      method: 'GET',
      // Add timeout to prevent hanging (Node 18+)
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`Network error: Cannot connect to ComfyUI at ${COMFYUI_HOST}. Is ComfyUI running?`);
    } else if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      console.error(`Timeout: ComfyUI at ${COMFYUI_HOST} did not respond within 5 seconds`);
    } else {
      console.error('ComfyUI availability check failed:', error);
    }
    return false;
  }
}

/**
 * Upload an image to ComfyUI
 * Returns the filename that ComfyUI uses to reference the image
 */
async function uploadImageToComfyUI(
  imagePath: string,
  imageBuffer: Buffer
): Promise<string> {
  // ComfyUI expects images in the input directory
  // We'll copy the image there or use the upload endpoint if available
  const formData = new FormData();
  // Convert Buffer to Uint8Array for Blob (compatible with BlobPart)
  const uint8Array = new Uint8Array(imageBuffer);
  const blob = new Blob([uint8Array]);
  formData.append('image', blob, imagePath.split('/').pop() || 'image.png');

  try {
    // Try using the upload endpoint if available
    const response = await fetch(`${COMFYUI_HOST}/upload/image`, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      return data.name || imagePath.split('/').pop() || 'image.png';
    }
  } catch (error) {
    console.warn('ComfyUI upload endpoint not available, using file path');
  }

  // Fallback: return the filename (ComfyUI will look in input/ directory)
  return imagePath.split('/').pop() || 'image.png';
}

/**
 * Submit a workflow to ComfyUI queue
 */
export async function queueComfyUIWorkflow(
  workflow: ComfyUIWorkflow
): Promise<ComfyUIQueueResponse> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
      signal: AbortSignal.timeout(10000), // 10 second timeout for workflow submission
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ComfyUI API error (${response.status}):`, errorText);
      throw new Error(`ComfyUI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('ECONNREFUSED'))) {
      const networkError = new Error(`Network error connecting to ComfyUI at ${COMFYUI_HOST}. Is ComfyUI running?`);
      console.error('ComfyUI network error:', error);
      throw networkError;
    }
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      const timeoutError = new Error(`Timeout: ComfyUI at ${COMFYUI_HOST} did not respond within 10 seconds`);
      console.error('ComfyUI timeout error:', error);
      throw timeoutError;
    }
    throw error;
  }
}

/**
 * Get ComfyUI queue status
 */
async function getComfyUIQueueStatus(): Promise<ComfyUIStatus> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/queue`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`ComfyUI API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('ECONNREFUSED'))) {
      console.error(`Network error connecting to ComfyUI at ${COMFYUI_HOST}:`, error);
      throw new Error(`Network error connecting to ComfyUI at ${COMFYUI_HOST}. Is ComfyUI running?`);
    }
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      console.error(`Timeout connecting to ComfyUI at ${COMFYUI_HOST}:`, error);
      throw new Error(`Timeout: ComfyUI at ${COMFYUI_HOST} did not respond within 5 seconds`);
    }
    throw error;
  }
}

/**
 * Get ComfyUI history for a specific prompt ID
 */
async function getComfyUIHistory(
  promptId: string
): Promise<{ [key: string]: unknown } | null> {
  try {
    // Try the specific prompt ID endpoint first
    const response = await fetch(`${COMFYUI_HOST}/history/${promptId}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      // If we get data and it has the prompt ID, return it
      if (data && (data[promptId] || Object.keys(data).length > 0)) {
        return data;
      }
    }

    // Fallback: get all history and find our prompt ID
    const allHistoryResponse = await fetch(`${COMFYUI_HOST}/history`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!allHistoryResponse.ok) {
      return null;
    }

    const allHistory = await allHistoryResponse.json();
    if (allHistory && allHistory[promptId]) {
      return { [promptId]: allHistory[promptId] };
    }

    return null;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`Network error connecting to ComfyUI at ${COMFYUI_HOST}:`, error);
    } else {
      console.error('Failed to get ComfyUI history:', error);
    }
    return null;
  }
}

/**
 * Get all ComfyUI history
 */
export async function getAllComfyUIHistory(): Promise<{ [key: string]: unknown } | null> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/history`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`Network error connecting to ComfyUI at ${COMFYUI_HOST}:`, error);
    } else {
      console.error('Failed to get all ComfyUI history:', error);
    }
    return null;
  }
}

/**
 * Get output image from ComfyUI
 * Uses Next.js proxy route for better reliability and CORS handling
 */
export function getComfyUIOutputImage(filename: string): string {
  // Use Next.js proxy route instead of direct ComfyUI URL for better reliability
  // This ensures images are accessible even if ComfyUI has CORS restrictions
  return `/api/comfyui/output?filename=${encodeURIComponent(filename)}`;
}

function resolveHistoryOutputImageUrl(outputs: ComfyHistoryOutputs): string | null {
  const image = findFirstHistoryOutputImage(outputs);
  if (!image) {
    return null;
  }

  return getComfyUIOutputImage(buildOutputImagePath(image));
}

/**
 * Find the most recent output image in the ComfyUI output directory
 * This is a fallback when history API doesn't return the image
 */
export async function findLatestOutputImage(
  promptId: string,
  filenamePrefix: string = 'anthroposcenic',
  jobStartTime?: number
): Promise<{ filename: string; imageUrl: string } | null> {
  try {
    const { readdir, stat } = await import('fs/promises');
    const { join } = await import('path');
    
    const outputDir = join(process.cwd(), 'comfyui', 'output');
    
    // Check if output directory exists
    try {
      await stat(outputDir);
    } catch {
      console.warn(`[FileSystem] Output directory not found: ${outputDir}`);
      return null;
    }
    
    // Read all files in output directory
    const files = await readdir(outputDir);
    
    // Filter for files matching the prefix (e.g., anthroposcenic_*.png)
    const matchingFiles = files.filter(f => 
      f.startsWith(filenamePrefix) && 
      (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp'))
    );
    
    if (matchingFiles.length === 0) {
      console.log(`[FileSystem] No files found with prefix "${filenamePrefix}" in output directory`);
      console.log(`[FileSystem]   Output directory: ${outputDir}`);
      console.log(`[FileSystem]   Total files in directory: ${files.length}`);
      if (files.length > 0) {
        console.log(`[FileSystem]   Sample files: ${files.slice(0, 5).join(', ')}`);
      }
      return null;
    }
    
    console.log(`[FileSystem] Found ${matchingFiles.length} file(s) matching prefix "${filenamePrefix}"`);
    
    // Get file stats and sort by modification time (newest first)
    // Use birthtime (creation time) if available, otherwise use mtime (modification time)
    const filesWithStats = await Promise.all(
      matchingFiles.map(async (filename) => {
        const filePath = join(outputDir, filename);
        const stats = await stat(filePath);
        // Prefer birthtime (creation time) if available, fallback to mtime
        const time = stats.birthtime && stats.birthtime.getTime() > 0 
          ? stats.birthtime.getTime() 
          : stats.mtime.getTime();
        return { 
          filename, 
          mtime: stats.mtime.getTime(), 
          birthtime: stats.birthtime?.getTime() || stats.mtime.getTime(),
          time, // Use this for sorting
          path: filePath 
        };
      })
    );
    
    // Sort by time (newest first) - use birthtime if available, otherwise mtime
    filesWithStats.sort((a, b) => b.time - a.time);
    
    // Log all files for debugging
    console.log(`[FileSystem] All matching files sorted by time (newest first):`);
    filesWithStats.slice(0, 5).forEach((f, i) => {
      console.log(`[FileSystem]   ${i + 1}. ${f.filename} - Time: ${new Date(f.time).toISOString()}, MTime: ${new Date(f.mtime).toISOString()}`);
    });
    
    // If jobStartTime is provided, filter to files created after job started
    // But be lenient - allow files created up to 10 seconds before job start (in case of clock skew or file system delays)
    let candidateFiles = filesWithStats;
    if (jobStartTime) {
      const adjustedStartTime = jobStartTime - 10000; // Allow 10 second window for clock skew and file system delays
      candidateFiles = filesWithStats.filter(f => f.time >= adjustedStartTime);
      
      console.log(`[FileSystem] Job started at: ${new Date(jobStartTime).toISOString()}`);
      console.log(`[FileSystem] Adjusted start time (with 10s window): ${new Date(adjustedStartTime).toISOString()}`);
      console.log(`[FileSystem] Files after adjusted start time: ${candidateFiles.length}`);
      
      if (candidateFiles.length === 0) {
        // No file was created at/after this job started. Do NOT fall back to an older
        // pre-existing image — that returns a STALE result and makes the poller report
        // completion before this job's SaveImage runs (e.g. when an early sampler hits
        // 100% in a multi-pass workflow). Signal "not ready yet" and keep polling.
        console.log(`[FileSystem] No output created after job start yet; not using a stale file`);
        return null;
      } else {
        console.log(`[FileSystem] Found ${candidateFiles.length} file(s) created after job start:`);
        candidateFiles.slice(0, 3).forEach((f, i) => {
          const age = f.time - jobStartTime;
          console.log(`[FileSystem]   ${i + 1}. ${f.filename} - Age: ${age}ms (${(age / 1000).toFixed(1)}s after job start)`);
        });
      }
    }
    
    if (candidateFiles.length > 0) {
      const latestFile = candidateFiles[0];
      const imageUrl = getComfyUIOutputImage(latestFile.filename);
      const fileAge = jobStartTime ? latestFile.time - jobStartTime : 0;
      console.log(`[FileSystem] ✅ Selected latest output image: ${latestFile.filename}`);
      console.log(`[FileSystem]   File time: ${new Date(latestFile.time).toISOString()}`);
      console.log(`[FileSystem]   File mtime: ${new Date(latestFile.mtime).toISOString()}`);
      console.log(`[FileSystem]   Job started: ${jobStartTime ? new Date(jobStartTime).toISOString() : 'unknown'}`);
      console.log(`[FileSystem]   File age relative to job: ${fileAge}ms (${(fileAge / 1000).toFixed(1)}s)`);
      console.log(`[FileSystem]   Image URL: ${imageUrl}`);
      
      // Verify this is actually the newest file
      if (filesWithStats.length > 1 && filesWithStats[0].filename !== latestFile.filename) {
        console.warn(`[FileSystem] ⚠️ WARNING: Selected file is not the absolute newest!`);
        console.warn(`[FileSystem]   Newest file: ${filesWithStats[0].filename} (${new Date(filesWithStats[0].time).toISOString()})`);
        console.warn(`[FileSystem]   Selected file: ${latestFile.filename} (${new Date(latestFile.time).toISOString()})`);
        // Use the absolute newest file instead
        const actualNewest = filesWithStats[0];
        const actualNewestUrl = getComfyUIOutputImage(actualNewest.filename);
        console.log(`[FileSystem] ✅ Using absolute newest file instead: ${actualNewest.filename}`);
        return { filename: actualNewest.filename, imageUrl: actualNewestUrl };
      }
      
      return { filename: latestFile.filename, imageUrl };
    }
    
    console.log(`[FileSystem] ❌ No candidate files found (total matching files: ${filesWithStats.length})`);
    return null;
  } catch (error) {
    console.error('[FileSystem] Error finding output image:', error);
    return null;
  }
}


/**
 * Copy image to ComfyUI input directory
 */
async function prepareImageForComfyUI(
  imagePath: string
): Promise<string> {
  try {
    // Read the image file
    const imageBuffer = await readFile(imagePath);
    const filename = imagePath.split('/').pop() || 'image.png';

    // ComfyUI input directory (relative to ComfyUI installation)
    // In a real setup, you'd copy the file there
    // For now, we'll return the filename and assume it's accessible
    // You may need to copy the file to comfyui/input/ directory
    
    return filename;
  } catch (error) {
    console.error('Failed to prepare image for ComfyUI:', error);
    throw error;
  }
}

type PollCompleteUpdate = {
  status: 'complete';
  progress: 100;
  imageUrl: string;
};

function completePollUpdate(imageUrl: string): PollCompleteUpdate {
  return { status: 'complete', progress: 100, imageUrl };
}

async function findFilesystemOutputUrl(
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

async function retryFindOutputUrl(
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

async function waitAndRecheckOutputUrl(
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

/**
 * Poll ComfyUI job status and get results
 * Uses WebSocket for real-time progress, falls back to HTTP polling for final image detection
 */
export async function* pollComfyUIJob(
  promptId: string,
  maxAttempts: number = 300, // Increased to 10 minutes (300 * 2s = 600s)
  intervalMs: number = 2000,
  useWebSocket: boolean = true // Enable WebSocket for real-time progress
): AsyncGenerator<import('@/types').ComfyUIProgressUpdate, void, unknown> {
  const jobStartTime = Date.now(); // Track when job started for filesystem fallback
  // Try WebSocket first if enabled
  if (useWebSocket) {
    try {
      const { streamComfyUIProgress } = await import('./comfyui-ws');
      let wsCompleted = false;
      
      // Stream WebSocket progress updates
      let lastProgress = 0;
      for await (const update of streamComfyUIProgress(promptId)) {
        if (update.status === 'error') {
          yield update;
          return;
        }
        if (update.status === 'timeout') {
          // Fall through to HTTP polling
          break;
        }
        
        // Yield all updates
        yield update;
        
        // Track progress
        if (update.progress !== undefined) {
          lastProgress = update.progress;
        }
        
        // Only treat execution_success as workflow completion — each KSampler also hits 100%.
        if (update.executionComplete) {
          wsCompleted = true;
          console.log(`[Poll] WebSocket indicated workflow completion, checking for image immediately...`);
          
          // Immediately check filesystem when we get 100% progress
          // Don't wait for WebSocket to close
          const immediateUrl = await findFilesystemOutputUrl(promptId, jobStartTime);
          if (immediateUrl) {
            console.log(`✅ ComfyUI job ${promptId} completed - found image immediately! URL: ${immediateUrl}`);
            yield completePollUpdate(immediateUrl);
            return;
          }
          console.log(`[Poll] Immediate filesystem check didn't find image, will retry after WebSocket closes...`);
        }
      }
      
      // Always check for image after WebSocket stream ends (if execution completed or high progress)
      if (lastProgress >= 95 || wsCompleted) {
        console.log(`[Poll] WebSocket stream ended (progress: ${lastProgress}%, completed: ${wsCompleted}), checking for output image...`);
        
        // Try filesystem first (most reliable) - check multiple times with increasing delays
        const postWebSocketUrl = await retryFindOutputUrl(promptId, jobStartTime, {
          maxAttempts: 6,
          checkHistoryEveryOther: true,
          logPrefix: '[Poll]',
        });
        if (postWebSocketUrl) {
          console.log(`✅ ComfyUI job ${promptId} completed! URL: ${postWebSocketUrl}`);
          yield completePollUpdate(postWebSocketUrl);
          return;
        }

        console.log(`[Poll] Image not found after ${6} attempts, falling through to HTTP polling...`);
      }
    } catch (error) {
      console.warn('WebSocket connection failed, falling back to HTTP polling:', error);
      // Fall through to HTTP polling
    }
  }
  
  // HTTP polling fallback (original implementation)
  let attempts = 0;
  let wasInQueue = false;

  while (attempts < maxAttempts) {
    try {
      // Check if job is still in queue
      const queueStatus = await getComfyUIQueueStatus();
      const queueRunning = queueStatus.queue_running || [];
      const queuePending = queueStatus.queue_pending || [];
      const isStillRunning = queueRunning.some((item: unknown[]) => 
        Array.isArray(item) && item.length > 1 && item[1] === promptId
      );
      const isPending = queuePending.some((item: unknown[]) => 
        Array.isArray(item) && item.length > 1 && item[1] === promptId
      );

      // Track if job was ever in queue
      if (isStillRunning || isPending) {
        wasInQueue = true;
      }

      // Check history for completed job (check all history more frequently for better detection)
      let history = await getComfyUIHistory(promptId);
      
      // If not found in specific history, check all history:
      // - Every attempt if job was in queue but is no longer running (most aggressive)
      // - Every 2 attempts if job was in queue and still processing (more frequent)
      // - Every 3 attempts otherwise (more frequent than before)
      if (!history) {
        const shouldCheckAllHistory = 
          (wasInQueue && !isStillRunning && !isPending) || // Job left queue - check every time
          (wasInQueue && attempts % 2 === 0) || // Job in queue - check every 2 attempts (more frequent)
          (!wasInQueue && attempts % 3 === 0); // Job never in queue - check every 3 attempts (more frequent)
        
        if (shouldCheckAllHistory) {
          const allHistory = await getAllComfyUIHistory();
          if (allHistory && allHistory[promptId]) {
            history = { [promptId]: allHistory[promptId] };
            console.log(`✅ Found prompt ${promptId} in all history (attempt ${attempts})`);
          }
        }
      }
      
      // Also check all history directly if job left queue (most reliable indicator of completion)
      if (wasInQueue && !isStillRunning && !isPending && !history) {
        console.log(`[HTTP Poll] Job left queue, checking all history directly...`);
        const allHistory = await getAllComfyUIHistory();
        if (allHistory && allHistory[promptId]) {
          history = { [promptId]: allHistory[promptId] };
          console.log(`✅ Found prompt ${promptId} in all history after leaving queue`);
        }
      }
      
      if (history && history[promptId]) {
        const jobData = history[promptId] as {
          outputs?: {
            [nodeId: string]: {
              images?: Array<{
                filename: string;
                subfolder?: string;
                type?: string;
              }>;
            };
          };
          status?: {
            completed?: Array<{
              outputs?: {
                [nodeId: string]: {
                  images?: Array<{
                    filename: string;
                    subfolder?: string;
                    type?: string;
                  }>;
                };
              };
            }>;
            messages?: Array<[string, unknown]>;
            node_errors?: Record<string, string[]>;
          };
        };
        
        // Check for execution errors first
        if (jobData.status?.node_errors && Object.keys(jobData.status.node_errors).length > 0) {
          const errorMessages = Object.entries(jobData.status.node_errors)
            .map(([node, errors]) => `Node ${node}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('; ');
          console.error(`ComfyUI job ${promptId} has errors:`, JSON.stringify(jobData.status.node_errors, null, 2));
          throw new Error(`ComfyUI workflow errors: ${errorMessages}`);
        }
        
        // Check for execution failure messages
        const hasFailureMessage = jobData.status?.messages?.some(
          (msg) => Array.isArray(msg) && msg[0] === 'execution_error' || msg[0] === 'execution_interrupted'
        );
        if (hasFailureMessage) {
          const failureMsg = jobData.status?.messages?.find(
            (msg) => Array.isArray(msg) && (msg[0] === 'execution_error' || msg[0] === 'execution_interrupted')
          );
          console.error(`ComfyUI job ${promptId} failed:`, failureMsg);
          
          // Extract error message from execution_error format: ["execution_error", {exception_message: "...", ...}]
          let errorMessage = `ComfyUI execution failed: ${JSON.stringify(failureMsg)}`;
          if (Array.isArray(failureMsg) && failureMsg.length > 1 && typeof failureMsg[1] === 'object') {
            const errorDetails = failureMsg[1] as { exception_message?: string; node_type?: string; ckpt_name?: string[] };
            if (errorDetails.exception_message) {
              errorMessage = errorDetails.exception_message;
              // Add context about which node/model failed
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
        
        // Check for execution_success message (indicates completion)
        const hasSuccessMessage = jobData.status?.messages?.some(
          (msg) => Array.isArray(msg) && msg[0] === 'execution_success'
        );
        
        // Check for outputs in the job data (ComfyUI history structure)
        if (jobData.outputs) {
          console.log(`[HTTP Poll] Checking outputs for prompt ${promptId}:`, Object.keys(jobData.outputs));
          const outputUrl = resolveHistoryOutputImageUrl(jobData.outputs);
          if (outputUrl) {
            console.log(`✅ ComfyUI job ${promptId} completed! URL: ${outputUrl}`);
            yield completePollUpdate(outputUrl);
            return;
          }
          console.log(`[HTTP Poll] No images found in outputs for prompt ${promptId}`);

          console.log(`[HTTP Poll] Trying filesystem fallback for prompt ${promptId}...`);
          const filesystemUrl = await findFilesystemOutputUrl(promptId, jobStartTime);
          if (filesystemUrl) {
            console.log(`✅ ComfyUI job ${promptId} completed via filesystem check! URL: ${filesystemUrl}`);
            yield completePollUpdate(filesystemUrl);
            return;
          }

          if (hasSuccessMessage) {
            const recheckUrl = await waitAndRecheckOutputUrl(promptId, jobStartTime);
            if (recheckUrl) {
              console.log(`✅ ComfyUI job ${promptId} completed after recheck! URL: ${recheckUrl}`);
              yield completePollUpdate(recheckUrl);
              return;
            }
          }
          console.warn(`Prompt ${promptId} found in history but no images in outputs or filesystem`);
        } else if (hasSuccessMessage) {
          // Execution succeeded but outputs not populated yet - wait and recheck
          console.log(`Job ${promptId} shows execution_success but outputs not ready, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue; // Re-check in next iteration
        } else {
          console.warn(`Prompt ${promptId} found in history but no outputs field`);
        }
        
        // Also check status.completed structure (alternative format)
        if (jobData.status?.completed && jobData.status.completed.length > 0) {
          const completed = jobData.status.completed[0];
          
          if (completed.outputs) {
            const imageUrl = resolveHistoryOutputImageUrl(completed.outputs);
            if (imageUrl) {
              console.log(`ComfyUI job ${promptId} completed! URL: ${imageUrl}`);
              yield completePollUpdate(imageUrl);
              return;
            }
          }
        }
      }

      // If job was in queue but is no longer running and not in history, it might have just completed
      // Check all history immediately when job leaves queue
      if (wasInQueue && !isStillRunning && !isPending && !history) {
        // Job left queue - check all history immediately
        const allHistory = await getAllComfyUIHistory();
        if (allHistory && allHistory[promptId]) {
          history = { [promptId]: allHistory[promptId] };
          console.log(`Found prompt ${promptId} in all history after leaving queue`);
        } else {
          // Job left queue but not in history yet - wait a bit more
          if (attempts < maxAttempts - 10) {
            console.log(`Job ${promptId} left queue but not in history yet, waiting... (attempt ${attempts})`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            attempts++;
            continue;
          }
        }
      }

      // Calculate progress based on queue position
      // Note: This is fallback progress estimation when WebSocket is not available
      // WebSocket provides actual progress values that match terminal output
      const queueRemaining = queuePending.length + (isStillRunning ? 1 : 0);
      
      // Estimate progress for HTTP polling fallback
      // WebSocket should provide actual progress values
      let progress: number;
      if (isStillRunning) {
        // Job is running, estimate 50-95% (will be 100% when complete)
        // Actual progress comes from WebSocket if available
        progress = Math.min(95, 50 + Math.min(45, attempts * 0.1));
        console.log(`[HTTP Poll] Job running, estimated progress: ${progress}% (attempt ${attempts})`);
      } else if (isPending) {
        // Job is pending in queue (0-20% range)
        progress = Math.min(20, Math.max(0, 20 - (queueRemaining * 5)));
        console.log(`[HTTP Poll] Job pending in queue (${queueRemaining} remaining), progress: ${progress}%`);
      } else if (wasInQueue) {
        // Job was in queue but no longer there - might be completing
        progress = 95;
        console.log(`[HTTP Poll] Job left queue, estimated progress: ${progress}%`);
      } else {
        // No queue info, use attempt-based progress
        progress = Math.min(50, attempts * 0.2);
        console.log(`[HTTP Poll] No queue info, estimated progress: ${progress}% (attempt ${attempts})`);
      }

      yield { status: 'processing', progress };

      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error) {
      console.error('Error polling ComfyUI job:', error);
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if this is a model corruption error and provide helpful guidance
      const { isCorruptionError } = await import('@/lib/model-downloader');
      if (isCorruptionError(errorMessage)) {
        // Extract model name from error if possible
        const modelMatch = errorMessage.match(/Model\s+([^\s:]+)/i) || 
                          errorMessage.match(/ckpt_name.*?\[.*?['"]([^'"]+)['"]/i);
        const modelName = modelMatch ? modelMatch[1] : 'the model file';
        
        errorMessage = `Model file "${modelName}" appears to be corrupted. The error suggests the safetensors file is invalid or incomplete.\n\n` +
          `To fix this:\n` +
          `1. Delete the corrupted file: comfyui/models/checkpoints/${modelName}\n` +
          `2. The model will be automatically re-downloaded on the next attempt, or\n` +
          `3. Download manually from Hugging Face or Civitai`;
      }
      
      yield { status: 'error', error: errorMessage };
      return;
    }
  }

  // Before timing out, do a final filesystem check as last resort
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
