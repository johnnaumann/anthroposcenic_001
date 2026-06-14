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
 * Get list of available samplers from ComfyUI
 */
export async function getAvailableSamplers(): Promise<string[]> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/object_info`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`ComfyUI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const ksamplerInfo = data?.KSampler?.input?.required?.sampler_name;
    
    // The sampler list format is typically [[list], {metadata}]
    if (Array.isArray(ksamplerInfo) && ksamplerInfo.length > 0) {
      // Check if first element is an array of sampler names
      if (Array.isArray(ksamplerInfo[0]) && ksamplerInfo[0].length > 0) {
        return ksamplerInfo[0] as string[];
      }
      // Or if it's a direct list of strings
      if (typeof ksamplerInfo[0] === 'string') {
        return ksamplerInfo as string[];
      }
    }
    
    // Fallback: return common sampler names
    return ['euler', 'euler_ancestral', 'dpm_2', 'dpm_2_ancestral', 'dpmpp_2m', 'dpmpp_2s_ancestral', 'lms', 'plms', 'ddim'];
  } catch (error) {
    console.error('Failed to get available samplers:', error);
    // Return common fallback samplers
    return ['euler', 'euler_ancestral', 'dpm_2', 'dpm_2_ancestral', 'dpmpp_2m', 'lms', 'plms', 'ddim'];
  }
}

/**
 * Validate and get a valid sampler name, with fallback
 */
export async function getValidSampler(requestedSampler: string): Promise<string> {
  const availableSamplers = await getAvailableSamplers();
  
  // If requested sampler is available, use it
  if (availableSamplers.includes(requestedSampler)) {
    return requestedSampler;
  }
  
  // Try common variations
  const variations: Record<string, string[]> = {
    'dpmpp_2m_karras': ['dpmpp_2m', 'dpmpp_2s_ancestral', 'dpm_2_ancestral'],
    'dpmpp_2m': ['dpm_2_ancestral', 'euler_ancestral', 'euler'],
    'euler_a': ['euler_ancestral', 'euler'],
  };
  
  if (variations[requestedSampler]) {
    for (const fallback of variations[requestedSampler]) {
      if (availableSamplers.includes(fallback)) {
        console.warn(`Sampler '${requestedSampler}' not available, using '${fallback}' instead`);
        return fallback;
      }
    }
  }
  
  // Final fallback: use first available sampler or 'euler'
  const fallback = availableSamplers.includes('euler') ? 'euler' : availableSamplers[0] || 'euler';
  console.warn(`Sampler '${requestedSampler}' not available, using '${fallback}' instead`);
  return fallback;
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
 * Uses Next.js proxy route for better reliability and CORS handling
 */
export function getComfyUIOutputImage(filename: string): string {
  // Use Next.js proxy route instead of direct ComfyUI URL for better reliability
  // This ensures images are accessible even if ComfyUI has CORS restrictions
  return `/api/comfyui/output?filename=${encodeURIComponent(filename)}`;
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
        // If no files created after job start, use the most recent file anyway
        console.log(`[FileSystem] ⚠️ No files created after job start, using most recent file anyway`);
        if (filesWithStats.length > 0) {
          candidateFiles = [filesWithStats[0]];
          console.log(`[FileSystem]   Selected: ${candidateFiles[0].filename} (${new Date(candidateFiles[0].time).toISOString()})`);
        }
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
 * Find an installed upscale (ESRGAN-style) model in comfyui/models/upscale_models.
 * Used by the hires pass for crisp, pixel-space detail. Returns null if none found.
 */
export async function getAvailableUpscaleModel(): Promise<string | null> {
  if (typeof process === 'undefined' || !process.versions?.node) return null;
  try {
    const { readdir, stat } = await import('fs/promises');
    const { join } = await import('path');
    const dir = join(process.cwd(), 'comfyui', 'models', 'upscale_models');
    const files = await readdir(dir);
    const models = files.filter(
      (f) => f.endsWith('.pth') || f.endsWith('.safetensors') || f.endsWith('.pt')
    );
    // Prefer a sharp, detail-oriented model when several are present.
    const preferred = models.find((m) => /ultrasharp|remacri|siax|nmkd|4x/i.test(m));
    const pick = preferred || models[0];
    if (!pick) return null;
    // Guard against tiny stub/placeholder files.
    try {
      const { size } = await stat(join(dir, pick));
      if (size < 1024 * 1024) return null; // < 1MB → not a real model
    } catch {
      /* ignore stat failure, assume usable */
    }
    return pick;
  } catch {
    return null;
  }
}

/**
 * Find an installed ControlNet model in comfyui/models/controlnet, optionally
 * matching a kind (e.g. 'tile', 'canny', 'depth'). Returns null if none found.
 */
export async function getAvailableControlNet(kind?: string): Promise<string | null> {
  if (typeof process === 'undefined' || !process.versions?.node) return null;
  try {
    const { readdir, stat } = await import('fs/promises');
    const { join } = await import('path');
    const dir = join(process.cwd(), 'comfyui', 'models', 'controlnet');
    const files = await readdir(dir);
    const models = files.filter(
      (f) => f.endsWith('.safetensors') || f.endsWith('.pth') || f.endsWith('.pt')
    );
    const matches = kind
      ? models.filter((m) => m.toLowerCase().includes(kind.toLowerCase()))
      : models;
    const pick = matches[0];
    if (!pick) return null;
    try {
      const { size } = await stat(join(dir, pick));
      if (size < 1024 * 1024) return null; // < 1MB → not a real model
    } catch {
      /* ignore stat failure, assume usable */
    }
    return pick;
  } catch {
    return null;
  }
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
  imageFilename: string | null, // null for text-to-image
  description: string,
  options: {
    checkpoint?: string; // Model checkpoint name (default: first available)
    seed?: number; // Random seed
    steps?: number; // Number of sampling steps
    cfgScale?: number; // CFG scale (lower = more creative, higher = more prompt adherence)
    denoiseStrength?: number; // Denoising strength for img2img (0-1, higher = more variation)
    sampler?: string; // Sampler name (e.g., 'euler', 'dpmpp_2m', 'dpmpp_2m_karras', 'euler_a')
    scheduler?: string; // Scheduler (e.g., 'normal', 'karras', 'exponential', 'simple')
    maxWidth?: number; // Maximum image width (optional, images are now compressed at upload)
    maxHeight?: number; // Maximum image height (optional, images are now compressed at upload)
    useImageResize?: boolean; // Whether to use ImageScale node (default: false, images are pre-compressed)
    negativePrompt?: string; // Custom negative prompt (default: creative variation-focused)
    creativity?: 'low' | 'medium' | 'high' | 'extreme' | 'quality' | 'quality-high' | 'vivid'; // Creativity preset (quality/vivid modes preserve detail)
    useImage?: boolean; // Whether to use img2img (true) or txt2img (false)
    width?: number; // Image width for txt2img (default: 1024)
    height?: number; // Image height for txt2img (default: 1024)
    qualityBoost?: boolean; // Append detail/quality booster tags to the positive prompt (default: true)
    hiresFix?: boolean; // Run an upscale + refine pass for added detail (default: true)
    hiresFactor?: number; // Final upscale multiplier vs the base image (default: 1.5)
    hiresDenoise?: number; // Denoise strength for the hires refine pass (default: auto)
    upscaleModel?: string; // ESRGAN upscale model filename (default: auto-detected from upscale_models)
    freeU?: boolean; // Apply FreeU_V2 for extra SD1.5 detail/contrast (default: true)
    controlNet?: boolean; // Use ControlNet Tile in the refine pass when a model is present (default: true)
    controlNetModel?: string; // ControlNet model filename (default: auto-detected tile model)
    controlNetStrength?: number; // ControlNet guidance strength for the refine pass (default: 0.65)
  } = {}
): Promise<ComfyUIWorkflow> {
  // Get creativity preset or use individual parameters
  // Default to 'vivid' for vivid, high-quality images, or use environment variable
  const creativity = options.creativity || (process.env.COMFYUI_CREATIVITY as 'low' | 'medium' | 'high' | 'extreme' | 'quality' | 'quality-high' | 'vivid') || 'vivid';
  
  // Define creativity presets
  // Balance between creativity (variation) and memory usage
  // Note: Sampler names will be validated against available ComfyUI samplers
  const creativityPresets = {
    low: {
      denoiseStrength: 0.65,
      cfgScale: 8.0,
      steps: 15, // Memory-optimized
      sampler: 'euler', // Common sampler, usually available
      scheduler: 'normal',
      negativePrompt: 'blurry, bad quality, distorted, watermark, low quality',
    },
    medium: {
      denoiseStrength: 0.75,
      cfgScale: 7.0,
      steps: 18, // Slightly more steps for better quality
      sampler: 'euler_ancestral', // More variation than euler
      scheduler: 'normal',
      negativePrompt: 'blurry, bad quality, distorted, watermark, exact copy, identical, duplicate',
    },
    high: {
      denoiseStrength: 0.85,
      cfgScale: 6.0,
      steps: 22, // Good balance of quality and memory
      sampler: 'dpmpp_2m', // More creative sampler (will try dpmpp_2m_karras first, fallback to this)
      scheduler: 'normal', // Use normal scheduler (karras scheduler may not be available)
      negativePrompt: 'blurry, bad quality, distorted, watermark, exact copy, identical, duplicate, replication, same as original, unchanged, unmodified',
    },
    extreme: {
      denoiseStrength: 0.95,
      cfgScale: 5.0,
      steps: 28, // Higher quality, more memory usage
      sampler: 'dpmpp_2m', // Will try variations, fallback to this
      scheduler: 'normal',
      negativePrompt: 'blurry, bad quality, distorted, watermark, exact copy, identical, duplicate, replication, same as original, unchanged, unmodified, faithful reproduction, precise copy',
    },
    // Quality-focused presets that preserve detail from original image
    quality: {
      denoiseStrength: 0.35, // Lower denoise preserves more original detail
      cfgScale: 8.0, // Higher CFG for better prompt adherence
      steps: 35, // More steps for better refinement
      sampler: 'dpmpp_2m', // High-quality sampler
      scheduler: 'normal',
      negativePrompt: 'blurry, bad quality, distorted, watermark, low quality, oversimplified, loss of detail, unrefined',
    },
    'quality-high': {
      denoiseStrength: 0.30, // Even lower denoise for maximum detail preservation
      cfgScale: 8.5, // Higher CFG for strong prompt adherence
      steps: 45, // Many steps for maximum refinement
      sampler: 'dpmpp_2m', // High-quality sampler
      scheduler: 'normal',
      negativePrompt: 'blurry, bad quality, distorted, watermark, low quality, oversimplified, loss of detail, unrefined, pixelated, artifacts',
    },
    // Vivid preset: Optimized for vivid, visually arresting images with good detail preservation
    // Balanced for quality and memory efficiency
    vivid: {
      denoiseStrength: 0.45, // Moderate denoise - preserves detail while allowing enhancement
      cfgScale: 7.5, // Optimal CFG for photorealistic quality without artifacts (7-7.5 range)
      steps: 32, // Good balance of quality and speed (30-35 range)
      sampler: 'dpmpp_2m', // Will try dpmpp_2m_karras first for better quality
      scheduler: 'normal', // Use normal scheduler (karras may not be available)
      negativePrompt: 'blurry, bad quality, distorted, watermark, low quality, oversimplified, loss of detail, unrefined, pixelated, artifacts, dull, faded, washed out, desaturated, low contrast, flat lighting',
    },
  };

  const preset = creativityPresets[creativity];
  
  const {
    checkpoint: providedCheckpoint = '',
    seed = Math.floor(Math.random() * 1000000),
    steps = preset.steps,
    cfgScale = preset.cfgScale,
    denoiseStrength = preset.denoiseStrength,
    sampler: requestedSampler = preset.sampler,
    scheduler = preset.scheduler,
    maxWidth = 1024, // Default max (images are pre-compressed at upload to 1024px max)
    maxHeight = 1024,
    useImageResize = false, // Images are now compressed at upload, so resize node is optional
    negativePrompt = preset.negativePrompt,
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

  // Validate and get a valid sampler (with fallback)
  // For quality/vivid/high/extreme presets, try dpmpp_2m_karras first for best quality
  let sampler = requestedSampler;
  if ((creativity === 'quality' || creativity === 'quality-high' || creativity === 'vivid' || creativity === 'high' || creativity === 'extreme') && requestedSampler === preset.sampler) {
    // Try dpmpp_2m_karras first for quality, vivid, and high creativity presets
    sampler = await getValidSampler('dpmpp_2m_karras');
  } else {
    // Validate the requested sampler (or preset default)
    sampler = await getValidSampler(requestedSampler);
  }

  // Determine if using image (img2img) or text-to-image (txt2img)
  const useImage = options.useImage !== false && imageFilename !== null;
  const txt2imgWidth = options.width || maxWidth;
  const txt2imgHeight = options.height || maxHeight;

  // Quality boosters: appended to the positive prompt to push toward crisp,
  // high-resolution, photographic-grade micro-detail while keeping the
  // generative/computer-art character. Style-agnostic (no "photo of ...").
  const qualityBoost = options.qualityBoost !== false;
  const QUALITY_BOOSTER = 'intricate ultra-fine detail, razor-sharp focus, crisp micro-texture, highly detailed surfaces, tack-sharp, high resolution, photographic clarity, fine grain, high dynamic range, generative digital art, intricate procedural detail, masterpiece, best quality';
  const ANTI_SOFT_NEGATIVE = 'soft focus, oversmoothed, low detail, plastic texture, motion blur';
  const cleanedDescription = description.trim().replace(/[\s,]+$/, '');
  const positivePrompt = qualityBoost
    ? `${cleanedDescription}, ${QUALITY_BOOSTER}`
    : description;
  const finalNegativePrompt = qualityBoost
    ? `${negativePrompt.trim().replace(/[\s,]+$/, '')}, ${ANTI_SOFT_NEGATIVE}`
    : negativePrompt;

  // FreeU_V2 sharpens and enriches SD1.5 output for free (no extra model).
  const freeU = options.freeU !== false;

  // Hires / detail pass. The biggest fix for "blurry up close" is to upscale in
  // PIXEL space with an ESRGAN model (if installed), supersample back down to the
  // target size, then run a higher-denoise refine so the model redraws real
  // micro-texture — far crisper than a latent upscale. Falls back to an improved
  // latent upscale when no upscale model is available.
  const useHires = options.hiresFix !== false;
  const hiresFactor = options.hiresFactor ?? 1.5;
  const hiresSteps = Math.max(14, Math.round(steps * 0.55));
  const upscaleModel = options.upscaleModel ?? (useHires ? await getAvailableUpscaleModel() : null);

  // ControlNet Tile (SD1.5): guides the refine pass so it can run a HIGHER denoise —
  // redrawing genuine micro-texture — without drifting off the upscaled structure.
  // Requires the ESRGAN image path (it conditions on the upscaled image).
  const controlNetEnabled = options.controlNet !== false;
  const tileModel = controlNetEnabled && useHires
    ? (options.controlNetModel ?? (await getAvailableControlNet('tile')))
    : null;
  const useTileRefine = !!(tileModel && upscaleModel);
  const controlNetStrength = options.controlNetStrength ?? 0.65;

  // Refine denoise: tile-guided refine can go hard (structure is held); plain ESRGAN
  // refine stays moderate; the latent fallback needs more to overcome its softness.
  const hiresDenoise = options.hiresDenoise ?? (useTileRefine ? 0.55 : upscaleModel ? 0.4 : 0.5);

  // ── Assemble the workflow graph ──────────────────────────────────────────────
  // Node IDs are arbitrary string keys; links are [nodeId, outputSlot].
  const workflow: ComfyUIWorkflow = {};

  // Checkpoint → MODEL[0], CLIP[1], VAE[2]
  workflow['ckpt'] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: checkpoint },
    _meta: { title: 'Load Checkpoint' },
  };
  const vae: [string, number] = ['ckpt', 2];

  // Optional FreeU on the model path (feeds every sampler).
  let modelSrc: [string, number] = ['ckpt', 0];
  if (freeU) {
    workflow['freeu'] = {
      class_type: 'FreeU_V2',
      inputs: { model: ['ckpt', 0], b1: 1.2, b2: 1.3, s1: 0.9, s2: 0.2 },
      _meta: { title: 'FreeU V2' },
    };
    modelSrc = ['freeu', 0];
  }

  // Prompts
  workflow['pos'] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: positivePrompt, clip: ['ckpt', 1] },
    _meta: { title: 'CLIP Text Encode (Positive)' },
  };
  workflow['neg'] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: finalNegativePrompt, clip: ['ckpt', 1] },
    _meta: { title: 'CLIP Text Encode (Negative)' },
  };

  // Base latent: img2img encodes the input image; txt2img uses an empty latent.
  let baseLatent: [string, number];
  if (useImage) {
    workflow['load'] = {
      class_type: 'LoadImage',
      inputs: { image: imageFilename! },
      _meta: { title: 'Load Image' },
    };
    let pixelSrc: [string, number] = ['load', 0];
    if (useImageResize) {
      workflow['resize'] = {
        class_type: 'ImageScale',
        inputs: {
          image: ['load', 0],
          upscale_method: 'lanczos',
          crop: 'disabled',
          width: maxWidth,
          height: maxHeight,
        },
        _meta: { title: 'Resize Image' },
      };
      pixelSrc = ['resize', 0];
    }
    workflow['enc'] = {
      class_type: 'VAEEncode',
      inputs: { pixels: pixelSrc, vae },
      _meta: { title: 'VAE Encode' },
    };
    baseLatent = ['enc', 0];
  } else {
    workflow['empty'] = {
      class_type: 'EmptyLatentImage',
      inputs: { width: txt2imgWidth, height: txt2imgHeight, batch_size: 1 },
      _meta: { title: 'Empty Latent Image (txt2img)' },
    };
    baseLatent = ['empty', 0];
  }

  // Base sampler
  workflow['ksampler'] = {
    class_type: 'KSampler',
    inputs: {
      seed,
      steps,
      cfg: cfgScale,
      sampler_name: sampler,
      scheduler,
      denoise: useImage ? denoiseStrength : 1.0, // full denoise for txt2img
      positive: ['pos', 0],
      negative: ['neg', 0],
      model: modelSrc,
      latent_image: baseLatent,
    },
    _meta: { title: 'KSampler (Base)' },
  };

  // Decode the base pass; the hires branch below may supersede the output.
  workflow['decode'] = {
    class_type: 'VAEDecode',
    inputs: { samples: ['ksampler', 0], vae },
    _meta: { title: 'VAE Decode (Base)' },
  };
  let imageOut: [string, number] = ['decode', 0];

  if (useHires && upscaleModel) {
    // Best path: pixel-space ESRGAN upscale → supersample down to target → refine.
    // This synthesises genuine crisp micro-texture instead of interpolating latents.
    workflow['upscale_model'] = {
      class_type: 'UpscaleModelLoader',
      inputs: { model_name: upscaleModel },
      _meta: { title: 'Load Upscale Model' },
    };
    workflow['upscale'] = {
      class_type: 'ImageUpscaleWithModel',
      inputs: { upscale_model: ['upscale_model', 0], image: ['decode', 0] },
      _meta: { title: 'ESRGAN Upscale' },
    };
    // ESRGAN models output ~4×; scale the result to hiresFactor of the original.
    workflow['downscale'] = {
      class_type: 'ImageScaleBy',
      inputs: { image: ['upscale', 0], upscale_method: 'lanczos', scale_by: hiresFactor / 4 },
      _meta: { title: 'Supersample Downscale' },
    };
    workflow['enc_hires'] = {
      class_type: 'VAEEncode',
      inputs: { pixels: ['downscale', 0], vae },
      _meta: { title: 'VAE Encode (Hires)' },
    };
    // ControlNet Tile conditions the refine on the upscaled image, so a higher
    // denoise redraws crisp texture while preserving the structure.
    let refinePos: [string, number] = ['pos', 0];
    let refineNeg: [string, number] = ['neg', 0];
    if (useTileRefine) {
      workflow['cn_loader'] = {
        class_type: 'ControlNetLoader',
        inputs: { control_net_name: tileModel! },
        _meta: { title: 'Load ControlNet (Tile)' },
      };
      workflow['cn_apply'] = {
        class_type: 'ControlNetApplyAdvanced',
        inputs: {
          positive: ['pos', 0],
          negative: ['neg', 0],
          control_net: ['cn_loader', 0],
          image: ['downscale', 0],
          strength: controlNetStrength,
          start_percent: 0,
          end_percent: 0.8,
        },
        _meta: { title: 'Apply ControlNet (Tile)' },
      };
      refinePos = ['cn_apply', 0];
      refineNeg = ['cn_apply', 1];
    }
    workflow['ksampler_hires'] = {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: hiresSteps,
        cfg: cfgScale,
        sampler_name: sampler,
        scheduler,
        denoise: hiresDenoise,
        positive: refinePos,
        negative: refineNeg,
        model: modelSrc,
        latent_image: ['enc_hires', 0],
      },
      _meta: { title: 'Hires Refine Sampler' },
    };
    workflow['decode_hires'] = {
      class_type: 'VAEDecode',
      inputs: { samples: ['ksampler_hires', 0], vae },
      _meta: { title: 'VAE Decode (Hires)' },
    };
    imageOut = ['decode_hires', 0];
  } else if (useHires) {
    // Fallback (no upscale model): latent upscale (bislerp) + higher-denoise refine.
    workflow['latent_upscale'] = {
      class_type: 'LatentUpscaleBy',
      inputs: { samples: ['ksampler', 0], upscale_method: 'bislerp', scale_by: hiresFactor },
      _meta: { title: 'Latent Upscale' },
    };
    workflow['ksampler_hires'] = {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: hiresSteps,
        cfg: cfgScale,
        sampler_name: sampler,
        scheduler,
        denoise: hiresDenoise,
        positive: ['pos', 0],
        negative: ['neg', 0],
        model: modelSrc,
        latent_image: ['latent_upscale', 0],
      },
      _meta: { title: 'Hires Refine Sampler' },
    };
    workflow['decode_hires'] = {
      class_type: 'VAEDecode',
      inputs: { samples: ['ksampler_hires', 0], vae },
      _meta: { title: 'VAE Decode (Hires)' },
    };
    imageOut = ['decode_hires', 0];
  }

  // Save
  workflow['save'] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: 'anthroposcenic', images: imageOut },
    _meta: { title: 'Save Image' },
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
        
        // If execution completed via WebSocket (progress 100%), mark as completed
        if (update.progress === 100) {
          wsCompleted = true;
          console.log(`[Poll] WebSocket indicated completion (progress: 100%), checking for image immediately...`);
          
          // Immediately check filesystem when we get 100% progress
          // Don't wait for WebSocket to close
          const immediateImage = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
          if (immediateImage) {
            console.log(`✅ ComfyUI job ${promptId} completed - found image immediately! Image: ${immediateImage.filename}, URL: ${immediateImage.imageUrl}`);
            yield { status: 'complete', progress: 100, imageUrl: immediateImage.imageUrl };
            return;
          }
          console.log(`[Poll] Immediate filesystem check didn't find image, will retry after WebSocket closes...`);
        }
      }
      
      // Always check for image after WebSocket stream ends (if execution completed or high progress)
      if (lastProgress >= 95 || wsCompleted) {
        console.log(`[Poll] WebSocket stream ended (progress: ${lastProgress}%, completed: ${wsCompleted}), checking for output image...`);
        
        // Try filesystem first (most reliable) - check multiple times with increasing delays
        for (let attempt = 0; attempt < 6; attempt++) {
          const delay = attempt === 0 ? 500 : 1000 * attempt; // 0.5s, 1s, 2s, 3s, 4s, 5s
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          console.log(`[Poll] Filesystem check attempt ${attempt + 1}/6 for prompt ${promptId} (after ${delay}ms delay)...`);
          const filesystemImage = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
          if (filesystemImage) {
            console.log(`✅ ComfyUI job ${promptId} completed via filesystem check! Image: ${filesystemImage.filename}, URL: ${filesystemImage.imageUrl}`);
            yield { status: 'complete', progress: 100, imageUrl: filesystemImage.imageUrl };
            return;
          }
          
          // Also try history API (every other attempt to balance speed and reliability)
          if (attempt % 2 === 1) {
            console.log(`[Poll] Checking history API for prompt ${promptId}...`);
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
              
              console.log(`[Poll] Found job in history, checking outputs...`, Object.keys(jobData.outputs || {}));
              
              if (jobData.outputs) {
                for (const [nodeId, nodeOutputs] of Object.entries(jobData.outputs)) {
                  console.log(`[Poll] Checking node ${nodeId} for images...`);
                  if (nodeOutputs.images && nodeOutputs.images.length > 0) {
                    const image = nodeOutputs.images[0];
                    const filename = image.filename;
                    const subfolder = image.subfolder || '';
                    const imagePath = subfolder ? `${subfolder}/${filename}` : filename;
                    const imageUrl = getComfyUIOutputImage(imagePath);
                    
                    console.log(`✅ ComfyUI job ${promptId} completed via history! Image: ${filename}, Path: ${imagePath}, URL: ${imageUrl}`);
                    yield { status: 'complete', progress: 100, imageUrl };
                    return;
                  }
                }
              }
              console.log(`[Poll] History found but no images in outputs`);
            } else {
              console.log(`[Poll] Job ${promptId} not found in history yet`);
            }
          }
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
          const failureMsg = jobData.status.messages.find(
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
          // Find SaveImage node output (node "9" in our workflow)
          for (const [nodeId, nodeOutputs] of Object.entries(jobData.outputs)) {
            console.log(`[HTTP Poll] Checking node ${nodeId}:`, nodeOutputs);
            if (nodeOutputs.images && nodeOutputs.images.length > 0) {
              const image = nodeOutputs.images[0];
              const filename = image.filename;
              const subfolder = image.subfolder || '';
              // Handle empty subfolder correctly
              const imagePath = subfolder ? `${subfolder}/${filename}` : filename;
              const imageUrl = getComfyUIOutputImage(imagePath);
              
              console.log(`✅ ComfyUI job ${promptId} completed! Image: ${filename}, Path: ${imagePath}, URL: ${imageUrl}`);
              yield { status: 'complete', progress: 100, imageUrl };
              return;
            }
          }
          console.log(`[HTTP Poll] No images found in outputs for prompt ${promptId}`);
          
          // Fallback: Check filesystem directly
          console.log(`[HTTP Poll] Trying filesystem fallback for prompt ${promptId}...`);
          const filesystemImage = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
          if (filesystemImage) {
            console.log(`✅ ComfyUI job ${promptId} completed via filesystem check! Image: ${filesystemImage.filename}, URL: ${filesystemImage.imageUrl}`);
            yield { status: 'complete', progress: 100, imageUrl: filesystemImage.imageUrl };
            return;
          }
          
          // If we have success message but no images yet, wait a bit more
          if (hasSuccessMessage) {
            console.log(`Job ${promptId} shows execution_success but no images yet, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
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
            
            // Final filesystem check after recheck
            const finalFilesystemImage = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
            if (finalFilesystemImage) {
              console.log(`✅ ComfyUI job ${promptId} completed via final filesystem check! Image: ${finalFilesystemImage.filename}`);
              yield { status: 'complete', progress: 100, imageUrl: finalFilesystemImage.imageUrl };
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
  const finalFilesystemImage = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
  if (finalFilesystemImage) {
    console.log(`✅ ComfyUI job ${promptId} found via final filesystem check! Image: ${finalFilesystemImage.filename}`);
    yield { status: 'complete', progress: 100, imageUrl: finalFilesystemImage.imageUrl };
    return;
  }
  
  console.warn(`ComfyUI job ${promptId} timed out after ${maxAttempts} attempts`);
  yield { status: 'timeout' };
}
