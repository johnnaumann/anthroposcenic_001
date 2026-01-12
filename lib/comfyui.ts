import { ComfyUIJob, ComfyUIStatus } from '@/types';
import { readFile } from 'fs/promises';
import { join } from 'path';

const COMFYUI_HOST = process.env.COMFYUI_HOST || 'http://localhost:8188';
const COMFYUI_WS_URL = process.env.COMFYUI_WS_URL || 'ws://localhost:8188/ws';

/**
 * ComfyUI Workflow Node Structure
 * Each node has a unique ID and contains inputs and class_type
 */
export interface ComfyUIWorkflowNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: {
    title?: string;
  };
}

export interface ComfyUIWorkflow {
  [nodeId: string]: ComfyUIWorkflowNode;
}

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
 * Get list of available checkpoints from ComfyUI
 * Checks both the API and filesystem
 */
export async function getAvailableCheckpoints(): Promise<string[]> {
  try {
    // First, try to get from API
    const response = await fetch(`${COMFYUI_HOST}/object_info`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`ComfyUI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const checkpointInfo = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name;
    
    // The checkpoint list format is typically [[list], {metadata}]
    if (Array.isArray(checkpointInfo) && checkpointInfo.length > 0) {
      // Check if first element is an array of checkpoint names
      if (Array.isArray(checkpointInfo[0]) && checkpointInfo[0].length > 0) {
        return checkpointInfo[0] as string[];
      }
      // Or if it's a direct list of strings
      if (typeof checkpointInfo[0] === 'string') {
        return checkpointInfo as string[];
      }
    }
    
    // If API doesn't return checkpoints, try filesystem (server-side only)
    // This will only work in Node.js environment
    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        const { readdir } = await import('fs/promises');
        const { join } = await import('path');
        const checkpointDir = join(process.cwd(), 'comfyui', 'models', 'checkpoints');
        const files = await readdir(checkpointDir);
        const checkpoints = files.filter(f => 
          f.endsWith('.safetensors') || f.endsWith('.ckpt')
        );
        return checkpoints;
      } catch (fsError) {
        // Filesystem check failed, return empty
        console.warn('Could not check filesystem for checkpoints:', fsError);
      }
    }
    
    return [];
  } catch (error) {
    console.error('Failed to get available checkpoints:', error);
    return [];
  }
}

/**
 * Upload an image to ComfyUI
 * Returns the filename that ComfyUI uses to reference the image
 */
export async function uploadImageToComfyUI(
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
export async function getComfyUIQueueStatus(): Promise<ComfyUIStatus> {
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
export async function getComfyUIHistory(
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
 */
export function getComfyUIOutputImage(filename: string): string {
  return `${COMFYUI_HOST}/view?filename=${encodeURIComponent(filename)}`;
}

/**
 * Create a complete ComfyUI workflow programmatically
 * This builds a workflow that:
 * 1. Loads the input image
 * 2. Encodes the text description using CLIP
 * 3. Processes the image (image-to-image or other processing)
 * 4. Saves the output
 * 
 * @param imageFilename - Filename of the image in ComfyUI's input directory
 * @param description - Text description/prompt for processing
 * @param options - Optional workflow configuration
 */
export async function createComfyUIWorkflow(
  imageFilename: string,
  description: string,
  options: {
    checkpoint?: string; // Model checkpoint name (default: first available)
    seed?: number; // Random seed
    steps?: number; // Number of sampling steps
    cfgScale?: number; // CFG scale
    denoiseStrength?: number; // Denoising strength for img2img (0-1)
    maxWidth?: number; // Maximum image width (default: 512 for memory optimization)
    maxHeight?: number; // Maximum image height (default: 512 for memory optimization)
  } = {}
): Promise<ComfyUIWorkflow> {
  const {
    checkpoint: providedCheckpoint = '',
    seed = Math.floor(Math.random() * 1000000),
    steps = 15, // Reduced from 20 to save memory
    cfgScale = 7.0,
    denoiseStrength = 0.75,
    maxWidth = 512, // Limit image size to reduce memory usage
    maxHeight = 512,
  } = options;

  // Get available checkpoints if none provided
  let checkpoint = providedCheckpoint;
  if (!checkpoint) {
    const availableCheckpoints = await getAvailableCheckpoints();
    if (availableCheckpoints.length === 0) {
      throw new Error('No checkpoint models available. Please install a Stable Diffusion checkpoint to comfyui/models/checkpoints/');
    }
    checkpoint = availableCheckpoints[0];
    console.log(`Using checkpoint: ${checkpoint}`);
  }

  // Generate unique node IDs
  const nodeIds = {
    loadImage: '1',
    resizeImage: '2', // Added for memory optimization
    loadCheckpoint: '3',
    clipTextEncode: '4',
    clipTextEncodeNegative: '5',
    vaeEncode: '6',
    kSampler: '7',
    vaeDecode: '8',
    saveImage: '9',
  };

  // Build the workflow
  const workflow: ComfyUIWorkflow = {
    // Node 1: Load Image
    [nodeIds.loadImage]: {
      class_type: 'LoadImage',
      inputs: {
        image: imageFilename,
      },
      _meta: { title: 'Load Image' },
    },

    // Node 2: Resize Image (Memory optimization - limit size)
    // Use ImageScale with "to" method to resize to specific dimensions
    [nodeIds.resizeImage]: {
      class_type: 'ImageScale',
      inputs: {
        upscale_method: 'lanczos',
        crop: 'disabled',
        width: maxWidth,
        height: maxHeight,
        images: [nodeIds.loadImage, 0],
      },
      _meta: { title: 'Resize Image (Memory Optimization)' },
    },

    // Node 3: Load Checkpoint (Model)
    [nodeIds.loadCheckpoint]: {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: checkpoint, // Empty string will use default/first available
      },
      _meta: { title: 'Load Checkpoint' },
    },

    // Node 4: CLIP Text Encode (Positive Prompt)
    [nodeIds.clipTextEncode]: {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: description,
        clip: [nodeIds.loadCheckpoint, 1], // Connect to CLIP output of checkpoint loader
      },
      _meta: { title: 'CLIP Text Encode (Positive)' },
    },

    // Node 5: CLIP Text Encode (Negative Prompt)
    [nodeIds.clipTextEncodeNegative]: {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: 'blurry, bad quality, distorted, watermark',
        clip: [nodeIds.loadCheckpoint, 1],
      },
      _meta: { title: 'CLIP Text Encode (Negative)' },
    },

    // Node 6: VAE Encode (Image to Latent)
    [nodeIds.vaeEncode]: {
      class_type: 'VAEEncode',
      inputs: {
        pixels: [nodeIds.resizeImage, 0], // Connect to resized image output
        vae: [nodeIds.loadCheckpoint, 2], // Connect to VAE output of checkpoint loader
      },
      _meta: { title: 'VAE Encode' },
    },

    // Node 7: KSampler (Image Generation/Processing)
    [nodeIds.kSampler]: {
      class_type: 'KSampler',
      inputs: {
        seed: seed,
        steps: steps,
        cfg: cfgScale,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: denoiseStrength,
        positive: [nodeIds.clipTextEncode, 0],
        negative: [nodeIds.clipTextEncodeNegative, 0],
        model: [nodeIds.loadCheckpoint, 0],
        latent_image: [nodeIds.vaeEncode, 0],
      },
      _meta: { title: 'KSampler' },
    },

    // Node 8: VAE Decode (Latent to Image)
    [nodeIds.vaeDecode]: {
      class_type: 'VAEDecode',
      inputs: {
        samples: [nodeIds.kSampler, 0],
        vae: [nodeIds.loadCheckpoint, 2],
      },
      _meta: { title: 'VAE Decode' },
    },

    // Node 9: Save Image
    [nodeIds.saveImage]: {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'anthroposcenic',
        images: [nodeIds.vaeDecode, 0],
      },
      _meta: { title: 'Save Image' },
    },
  };

  return workflow;
}

/**
 * Copy image to ComfyUI input directory
 */
export async function prepareImageForComfyUI(
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

/**
 * Poll ComfyUI job status and get results
 * Uses WebSocket for real-time progress, falls back to HTTP polling for final image detection
 */
export async function* pollComfyUIJob(
  promptId: string,
  maxAttempts: number = 300, // Increased to 10 minutes (300 * 2s = 600s)
  intervalMs: number = 2000,
  useWebSocket: boolean = true // Enable WebSocket for real-time progress
): AsyncGenerator<{ status: string; progress?: number; imageUrl?: string; error?: string }, void, unknown> {
  // Try WebSocket first if enabled
  if (useWebSocket) {
    try {
      const { streamComfyUIProgress } = await import('./comfyui-ws');
      let wsCompleted = false;
      
      // Stream WebSocket progress updates
      for await (const update of streamComfyUIProgress(promptId)) {
        if (update.status === 'error') {
          yield update;
          return;
        }
        if (update.status === 'timeout') {
          // Fall through to HTTP polling
          break;
        }
        yield update;
        
        // If execution completed via WebSocket, check history for final image
        if (update.progress === 99) {
          wsCompleted = true;
          break;
        }
      }
      
      // If WebSocket indicated completion, check history for final image
      if (wsCompleted) {
        // Check history for completed job with outputs
        const history = await getAllComfyUIHistory();
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
          };
          
          if (jobData.outputs) {
            for (const [nodeId, nodeOutputs] of Object.entries(jobData.outputs)) {
              if (nodeOutputs.images && nodeOutputs.images.length > 0) {
                const image = nodeOutputs.images[0];
                const filename = image.filename;
                const subfolder = image.subfolder || '';
                const imagePath = subfolder ? `${subfolder}/${filename}` : filename;
                const imageUrl = getComfyUIOutputImage(imagePath);
                
                console.log(`✅ ComfyUI job ${promptId} completed via WebSocket! Image: ${filename}`);
                yield { status: 'complete', progress: 100, imageUrl };
                return;
              }
            }
          }
        }
        // If no image found yet, fall through to HTTP polling
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
      // - Every 5 attempts otherwise
      if (!history) {
        const shouldCheckAllHistory = 
          (wasInQueue && !isStillRunning && !isPending) || // Job left queue - check every time
          (wasInQueue && attempts % 2 === 0) || // Job in queue - check every 2 attempts (more frequent)
          (!wasInQueue && attempts % 5 === 0); // Job never in queue - check every 5 attempts
        
        if (shouldCheckAllHistory) {
          const allHistory = await getAllComfyUIHistory();
          if (allHistory && allHistory[promptId]) {
            history = { [promptId]: allHistory[promptId] };
            console.log(`✅ Found prompt ${promptId} in all history (attempt ${attempts})`);
          }
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
            .map(([node, errors]) => `Node ${node}: ${errors.join(', ')}`)
            .join('; ');
          console.error(`ComfyUI job ${promptId} has errors:`, errorMessages);
          throw new Error(`ComfyUI workflow errors: ${errorMessages}`);
        }
        
        // Check for execution failure messages
        const hasFailureMessage = jobData.status?.messages?.some(
          (msg) => Array.isArray(msg) && msg[0] === 'execution_error' || msg[0] === 'execution_interrupted'
        );
        if (hasFailureMessage) {
          const failureMsg = jobData.status.messages.find(
            (msg) => Array.isArray(msg) && (msg[0] === 'execution_error' || msg[0] === 'execution_interrupted')
          );
          console.error(`ComfyUI job ${promptId} failed:`, failureMsg);
          throw new Error(`ComfyUI execution failed: ${JSON.stringify(failureMsg)}`);
        }
        
        // Check for execution_success message (indicates completion)
        const hasSuccessMessage = jobData.status?.messages?.some(
          (msg) => Array.isArray(msg) && msg[0] === 'execution_success'
        );
        
        // Check for outputs in the job data (ComfyUI history structure)
        if (jobData.outputs) {
          console.log(`Checking outputs for prompt ${promptId}:`, Object.keys(jobData.outputs));
          // Find SaveImage node output (usually node "8" in our workflow)
          for (const [nodeId, nodeOutputs] of Object.entries(jobData.outputs)) {
            if (nodeOutputs.images && nodeOutputs.images.length > 0) {
              const image = nodeOutputs.images[0];
              const filename = image.filename;
              const subfolder = image.subfolder || '';
              // Handle empty subfolder correctly
              const imagePath = subfolder ? `${subfolder}/${filename}` : filename;
              const imageUrl = getComfyUIOutputImage(imagePath);
              
              console.log(`✅ ComfyUI job ${promptId} completed! Image: ${filename}, URL: ${imageUrl}`);
              yield { status: 'complete', progress: 100, imageUrl };
              return;
            }
          }
          // If we have success message but no images yet, wait a bit more
          if (hasSuccessMessage) {
            console.log(`Job ${promptId} shows execution_success but no images yet, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Re-check history after short wait
            const recheckHistory = await getAllComfyUIHistory();
            if (recheckHistory && recheckHistory[promptId]) {
              const recheckData = recheckHistory[promptId] as typeof jobData;
              if (recheckData.outputs) {
                for (const [nodeId, nodeOutputs] of Object.entries(recheckData.outputs)) {
                  if (nodeOutputs.images && nodeOutputs.images.length > 0) {
                    const image = nodeOutputs.images[0];
                    const filename = image.filename;
                    const subfolder = image.subfolder || '';
                    const imagePath = subfolder ? `${subfolder}/${filename}` : filename;
                    const imageUrl = getComfyUIOutputImage(imagePath);
                    console.log(`✅ ComfyUI job ${promptId} completed after recheck! Image: ${filename}`);
                    yield { status: 'complete', progress: 100, imageUrl };
                    return;
                  }
                }
              }
            }
          }
          console.warn(`Prompt ${promptId} found in history but no images in outputs`);
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
            for (const nodeOutputs of Object.values(completed.outputs)) {
              if (nodeOutputs.images && nodeOutputs.images.length > 0) {
                const image = nodeOutputs.images[0];
                const filename = image.filename;
                const subfolder = image.subfolder || '';
                const imagePath = subfolder ? `${subfolder}/${filename}` : filename;
                const imageUrl = getComfyUIOutputImage(imagePath);
                
                console.log(`ComfyUI job ${promptId} completed! Image: ${filename}`);
                yield { status: 'complete', progress: 100, imageUrl };
                return;
              }
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
      const queueRemaining = queuePending.length + (isStillRunning ? 1 : 0);
      
      // Estimate progress: 0-90% based on queue, 90-99% when processing
      let progress: number;
      if (isStillRunning) {
        // Job is running, estimate 90-99% (will be 100% when complete)
        progress = Math.min(99, 90 + Math.min(9, attempts * 0.05));
      } else if (isPending) {
        // Job is pending in queue
        progress = Math.min(90, Math.max(10, 100 - (queueRemaining * 15)));
      } else if (wasInQueue) {
        // Job was in queue but no longer there - might be completing
        progress = 98;
      } else {
        // No queue info, use attempt-based progress
        progress = Math.min(95, attempts * 0.5);
      }

      yield { status: 'processing', progress };

      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error) {
      console.error('Error polling ComfyUI job:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      yield { status: 'error', error: errorMessage };
      return;
    }
  }

  console.warn(`ComfyUI job ${promptId} timed out after ${maxAttempts} attempts`);
  yield { status: 'timeout' };
}
