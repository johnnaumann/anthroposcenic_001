import { DEFAULT_NEGATIVE_PROMPT } from '@/lib/comfyui-defaults';
import { COMFYUI_HOST } from '@/lib/comfyui-helpers';
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

export {
  getAllComfyUIHistory,
  getComfyUIOutputImage,
  findLatestOutputImage,
} from './comfyui-output';

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
