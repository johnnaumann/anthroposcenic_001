/**
 * Model downloader utility for ComfyUI checkpoints
 */

import { existsSync, createWriteStream } from 'fs';
import { join } from 'path';

const CHECKPOINTS_DIR = join(process.cwd(), 'comfyui', 'models', 'checkpoints');

// Model registry with download URLs
const MODEL_REGISTRY: Record<string, string> = {
  'Deliberate_v2.safetensors': 'https://huggingface.co/XpucT/Deliberate/resolve/main/Deliberate_v2.safetensors',
  'DreamShaper_8.safetensors': 'https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8.safetensors',
  'AbyssOrangeMix3.safetensors': 'https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AbyssOrangeMix3.safetensors',
  'anything-v5.0-pruned.safetensors': 'https://huggingface.co/andite/anything-v4.0/resolve/main/anything-v5.0-pruned.safetensors',
  'chilloutmix_NiPrunedFp32Fix.safetensors': 'https://huggingface.co/TASUKU2023/Chilloutmix/resolve/main/chilloutmix_NiPrunedFp32Fix.safetensors',
  'Realistic_Vision_V5.1_fp16-no-ema.safetensors': 'https://huggingface.co/SG161222/Realistic_Vision_V5.1_noVAE/resolve/main/Realistic_Vision_V5.1_fp16-no-ema.safetensors',
  'revAnimated_v122.safetensors': 'https://huggingface.co/hanafuusen2001/ReVAnimated/resolve/main/revAnimated_v122.safetensors',
  'sd-v1-5.safetensors': 'https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors',
  'v1-5-pruned.safetensors': 'https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors',
  // Abstract art models
  // Note: AbstractArt_v2.safetensors - if you find this model, add its URL here
  // Popular abstract art alternative:
  'SDArt_Complete_Edition.safetensors': 'https://huggingface.co/Guizmus/SDArt_Complete_Edition/resolve/main/SDArt_Complete_Edition.safetensors',
};

/**
 * Check if a checkpoint model exists
 */
export function checkpointExists(checkpoint: string): boolean {
  const filePath = join(CHECKPOINTS_DIR, checkpoint);
  return existsSync(filePath);
}

/**
 * Attempt to construct a Hugging Face URL from model name
 * This is a best-guess approach and may not work for all models
 */
function tryConstructHuggingFaceUrl(checkpoint: string): string | null {
  // Remove extension
  const modelName = checkpoint.replace(/\.(safetensors|ckpt)$/, '');
  
  // Try common Hugging Face patterns
  const patterns = [
    `https://huggingface.co/${modelName}/resolve/main/${checkpoint}`,
    `https://huggingface.co/${modelName}/resolve/main/${modelName}.safetensors`,
    `https://huggingface.co/${modelName}/resolve/main/${modelName}.ckpt`,
  ];
  
  // Return first pattern (we'll test it)
  return patterns[0];
}

/**
 * Download a checkpoint model if it doesn't exist
 * Returns the file path if successful, null if failed
 */
export async function downloadCheckpoint(
  checkpoint: string,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  const filePath = join(CHECKPOINTS_DIR, checkpoint);
  
  // Check if already exists
  if (existsSync(filePath)) {
    console.log(`[ModelDownloader] ✅ Checkpoint already exists: ${checkpoint}`);
    return filePath;
  }

  // Check if we have a download URL for this model
  let downloadUrl = MODEL_REGISTRY[checkpoint];
  
  // If not in registry, try to construct a Hugging Face URL
  if (!downloadUrl) {
    console.log(`[ModelDownloader] Model not in registry, attempting to construct Hugging Face URL for: ${checkpoint}`);
    downloadUrl = tryConstructHuggingFaceUrl(checkpoint);
    
    if (!downloadUrl) {
      console.error(`[ModelDownloader] ❌ No download URL found for checkpoint: ${checkpoint}`);
      console.error(`[ModelDownloader] Available models in registry: ${Object.keys(MODEL_REGISTRY).join(', ')}`);
      console.error(`[ModelDownloader] 💡 To add this model, either:`);
      console.error(`[ModelDownloader]    1. Download it manually to: ${CHECKPOINTS_DIR}`);
      console.error(`[ModelDownloader]    2. Add it to MODEL_REGISTRY in lib/model-downloader.ts`);
      return null;
    }
    
    console.log(`[ModelDownloader] Attempting constructed URL: ${downloadUrl}`);
  }

  try {
    console.log(`[ModelDownloader] 📥 Starting download: ${checkpoint}`);
    console.log(`[ModelDownloader] 🔗 URL: ${downloadUrl}`);
    
    // Ensure directory exists
    const { mkdir } = await import('fs/promises');
    await mkdir(CHECKPOINTS_DIR, { recursive: true });

    // Download the file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout for large files

    try {
      console.log(`[ModelDownloader] ⏳ Fetching from URL...`);
      const response = await fetch(downloadUrl, {
        signal: controller.signal,
      });

      if (!response.ok) {
        // If constructed URL failed, provide helpful error
        if (!MODEL_REGISTRY[checkpoint]) {
          console.error(`[ModelDownloader] ❌ Constructed URL failed (${response.status} ${response.statusText})`);
          console.error(`[ModelDownloader] 💡 This model may not be available at the guessed URL.`);
          console.error(`[ModelDownloader] 💡 Please download manually from Hugging Face or Civitai to: ${CHECKPOINTS_DIR}`);
          throw new Error(`Model not found at constructed URL. Please download manually.`);
        }
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      
      console.log(`[ModelDownloader] ✅ Connection established, starting download...`);

      if (!response.body) {
        throw new Error('No response body');
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let downloadedBytes = 0;
      
      if (totalBytes > 0) {
        const sizeMB = (totalBytes / (1024 * 1024)).toFixed(2);
        console.log(`[ModelDownloader] 📊 File size: ${sizeMB} MB`);
      } else {
        console.log(`[ModelDownloader] 📊 File size: Unknown (streaming)`);
      }

      const fileStream = createWriteStream(filePath);
      const reader = response.body.getReader();
      
      let lastProgressLog = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          fileStream.write(value);
          downloadedBytes += value.length;

          if (onProgress && totalBytes > 0) {
            const progress = (downloadedBytes / totalBytes) * 100;
            onProgress(progress);
            
            // Log progress every 10%
            if (Math.floor(progress / 10) > lastProgressLog) {
              lastProgressLog = Math.floor(progress / 10);
              const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(2);
              console.log(`[ModelDownloader] ⬇️  Download progress: ${Math.round(progress)}% (${downloadedMB} MB)`);
            }
          } else if (onProgress) {
            // If we don't know total size, just report bytes downloaded
            const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(2);
            onProgress(downloadedBytes); // Pass bytes instead of percentage
          }
        }

        // Close the file stream properly
        await new Promise<void>((resolve, reject) => {
          fileStream.end((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        clearTimeout(timeoutId);
        console.log(`[ModelDownloader] ✅ Successfully downloaded: ${checkpoint}`);
        return filePath;
      } catch (streamError) {
        clearTimeout(timeoutId);
        // Close file stream on error
        fileStream.destroy();
        if (streamError instanceof Error && streamError.name === 'AbortError') {
          throw new Error('Download timeout - file is too large or connection is slow');
        }
        throw streamError;
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error(`[ModelDownloader] ❌ Failed to download ${checkpoint}:`, error);
    // Clean up partial file
    try {
      const { unlink } = await import('fs/promises');
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
    return null;
  }
}

/**
 * Ensure a checkpoint is available, downloading if necessary
 */
export async function ensureCheckpoint(
  checkpoint: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  if (checkpointExists(checkpoint)) {
    return true;
  }

  const downloaded = await downloadCheckpoint(checkpoint, onProgress);
  return downloaded !== null;
}
