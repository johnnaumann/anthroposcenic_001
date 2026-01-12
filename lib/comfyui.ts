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
    });
    return response.ok;
  } catch (error) {
    console.error('ComfyUI availability check failed:', error);
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
  const response = await fetch(`${COMFYUI_HOST}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ComfyUI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Get ComfyUI queue status
 */
export async function getComfyUIQueueStatus(): Promise<ComfyUIStatus> {
  const response = await fetch(`${COMFYUI_HOST}/queue`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`ComfyUI API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get ComfyUI history
 */
export async function getComfyUIHistory(
  promptId: string
): Promise<{ [key: string]: unknown } | null> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/history/${promptId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get ComfyUI history:', error);
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
  } = {}
): Promise<ComfyUIWorkflow> {
  const {
    checkpoint: providedCheckpoint = '',
    seed = Math.floor(Math.random() * 1000000),
    steps = 20,
    cfgScale = 7.0,
    denoiseStrength = 0.75,
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
    loadCheckpoint: '2',
    clipTextEncode: '3',
    clipTextEncodeNegative: '4',
    vaeEncode: '5',
    kSampler: '6',
    vaeDecode: '7',
    saveImage: '8',
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

    // Node 2: Load Checkpoint (Model)
    [nodeIds.loadCheckpoint]: {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: checkpoint, // Empty string will use default/first available
      },
      _meta: { title: 'Load Checkpoint' },
    },

    // Node 3: CLIP Text Encode (Positive Prompt)
    [nodeIds.clipTextEncode]: {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: description,
        clip: [nodeIds.loadCheckpoint, 1], // Connect to CLIP output of checkpoint loader
      },
      _meta: { title: 'CLIP Text Encode (Positive)' },
    },

    // Node 4: CLIP Text Encode (Negative Prompt)
    [nodeIds.clipTextEncodeNegative]: {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: 'blurry, bad quality, distorted, watermark',
        clip: [nodeIds.loadCheckpoint, 1],
      },
      _meta: { title: 'CLIP Text Encode (Negative)' },
    },

    // Node 5: VAE Encode (Image to Latent)
    [nodeIds.vaeEncode]: {
      class_type: 'VAEEncode',
      inputs: {
        pixels: [nodeIds.loadImage, 0], // Connect to image output
        vae: [nodeIds.loadCheckpoint, 2], // Connect to VAE output of checkpoint loader
      },
      _meta: { title: 'VAE Encode' },
    },

    // Node 6: KSampler (Image Generation/Processing)
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

    // Node 7: VAE Decode (Latent to Image)
    [nodeIds.vaeDecode]: {
      class_type: 'VAEDecode',
      inputs: {
        samples: [nodeIds.kSampler, 0],
        vae: [nodeIds.loadCheckpoint, 2],
      },
      _meta: { title: 'VAE Decode' },
    },

    // Node 8: Save Image
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
 */
export async function* pollComfyUIJob(
  promptId: string,
  maxAttempts: number = 120, // Increased for longer processing times
  intervalMs: number = 2000
): AsyncGenerator<{ status: string; progress?: number; imageUrl?: string }, void, unknown> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const history = await getComfyUIHistory(promptId);
      
      if (history && history[promptId]) {
        const jobData = history[promptId] as {
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
          };
        };
        
        if (jobData.status?.completed && jobData.status.completed.length > 0) {
          // Job completed, extract output images
          const completed = jobData.status.completed[0];
          
          if (completed.outputs) {
            // Find SaveImage node output
            for (const nodeOutputs of Object.values(completed.outputs)) {
              if (nodeOutputs.images && nodeOutputs.images.length > 0) {
                const image = nodeOutputs.images[0];
                const filename = image.filename;
                const subfolder = image.subfolder || '';
                const imagePath = subfolder ? `${subfolder}/${filename}` : filename;
                const imageUrl = getComfyUIOutputImage(imagePath);
                
                yield { status: 'complete', progress: 100, imageUrl };
                return;
              }
            }
          }
        }
      }

      // Check queue status for progress estimation
      const queueStatus = await getComfyUIQueueStatus();
      const queueRemaining = queueStatus.exec_info?.queue_remaining || 0;
      
      // Estimate progress (rough approximation)
      const progress = Math.min(95, Math.max(0, 100 - (queueRemaining * 5)));

      yield { status: 'processing', progress };

      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error) {
      console.error('Error polling ComfyUI job:', error);
      yield { status: 'error' };
      return;
    }
  }

  yield { status: 'timeout' };
}
