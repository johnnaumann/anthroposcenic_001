import { NextRequest } from 'next/server';
import { readFile, copyFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { queueComfyUIWorkflow, pollComfyUIJob, createComfyUIWorkflow, checkComfyUIAvailability } from '@/lib/comfyui';
import { startComfyUI } from '@/lib/comfyui-startup';
import { ensureCheckpoint } from '@/lib/model-downloader';
import { sendStreamMessage, sendStreamError, closeStream } from '@/lib/streaming';
import { ComfyUIProcessRequest } from '@/types';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const EXPORTS_DIR = process.env.EXPORTS_DIR || './data/exports';

async function findImageFile(imageId: string): Promise<{ path: string; mimeType: string } | null> {
  const uploadPath = join(process.cwd(), UPLOAD_DIR);
  const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };

  for (const ext of extensions) {
    const candidatePath = join(uploadPath, `${imageId}.${ext}`);
    if (existsSync(candidatePath)) {
      return {
        path: candidatePath,
        mimeType: mimeTypes[ext] || `image/${ext}`,
      };
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
  });

  // Process asynchronously
  (async () => {
    try {
      const body: ComfyUIProcessRequest = await request.json();
      const { imageId, config, workflow: customWorkflow, useImage = true, width = 1024, height = 1024 } = body;

      if (!config) {
        sendStreamError(controller, 'Config is required');
        return;
      }

      if (!config.description || !config.checkpoint) {
        sendStreamError(controller, 'Config must include description and checkpoint');
        return;
      }

      // If useImage is true, imageId is required
      if (useImage && !imageId) {
        sendStreamError(controller, 'Image ID is required when using image-to-image mode');
        return;
      }

      // Start ComfyUI if not running
      sendStreamMessage(controller, {
        type: 'status',
        data: 'Starting ComfyUI...',
      });

      const comfyuiReady = await startComfyUI();
      if (!comfyuiReady) {
        sendStreamError(controller, 'Failed to start ComfyUI. Please ensure ComfyUI is set up: npm run comfyui:setup');
        return;
      }

      // Ensure checkpoint model is available
      sendStreamMessage(controller, {
        type: 'status',
        data: `Checking for model: ${config.checkpoint}...`,
      });
      console.log(`[ComfyUI Process] Checking for model: ${config.checkpoint}`);

      const checkpointReady = await ensureCheckpoint(config.checkpoint, (progress) => {
        // Progress can be a percentage (0-100) or bytes downloaded
        if (typeof progress === 'number' && progress <= 100) {
          const progressPercent = Math.round(progress);
          sendStreamMessage(controller, {
            type: 'status',
            data: `Downloading model: ${progressPercent}%`,
          });
          console.log(`[ComfyUI Process] Download progress: ${progressPercent}%`);
        } else {
          // Bytes downloaded (when total size unknown)
          const mb = ((progress as number) / (1024 * 1024)).toFixed(2);
          sendStreamMessage(controller, {
            type: 'status',
            data: `Downloading model: ${mb} MB downloaded...`,
          });
          console.log(`[ComfyUI Process] Download progress: ${mb} MB`);
        }
      });

      if (!checkpointReady) {
        const errorMsg = `Model ${config.checkpoint} is not available and could not be downloaded automatically. Please download it manually to: comfyui/models/checkpoints/`;
        console.error(`[ComfyUI Process] ${errorMsg}`);
        sendStreamError(controller, errorMsg);
        return;
      }
      
      console.log(`[ComfyUI Process] ✅ Model ready: ${config.checkpoint}`);
      console.log(`[ComfyUI Process] Mode: ${useImage ? 'img2img' : 'txt2img'}`);

      let comfyImageFilename: string | null = null;
      let imageBase64: string | null = null;

      // Only prepare image if using img2img mode
      if (useImage && imageId) {
        // Find the image file
        const imageFile = await findImageFile(imageId);
        if (!imageFile) {
          sendStreamError(controller, 'Image not found');
          return;
        }

        // Prepare image for ComfyUI (copy to input directory if needed)
        sendStreamMessage(controller, {
          type: 'status',
          data: 'Preparing image for ComfyUI...',
        });

        try {
          // Try to copy image to ComfyUI input directory
          const comfyInputDir = join(process.cwd(), 'comfyui', 'input');
          await mkdir(comfyInputDir, { recursive: true });
          
          const imageBuffer = await readFile(imageFile.path);
          imageBase64 = imageBuffer.toString('base64');
          const extension = imageFile.path.split('.').pop() || 'png';
          const filename = `${imageId}.${extension}`;
          const comfyImagePath = join(comfyInputDir, filename);
          
          await copyFile(imageFile.path, comfyImagePath);
          comfyImageFilename = filename;
        } catch (error) {
          console.warn('Failed to copy image to ComfyUI input, using filename:', error);
          // Fallback: use just the filename (assumes image is accessible)
          const imageBuffer = await readFile(imageFile.path);
          imageBase64 = imageBuffer.toString('base64');
          comfyImageFilename = imageFile.path.split('/').pop() || `${imageId}.png`;
        }
      } else {
        sendStreamMessage(controller, {
          type: 'status',
          data: 'Using text-to-image mode (no input image)...',
        });
      }

      // Save description and base64 image to exports folder for git tracking
      try {
        const exportsPath = join(process.cwd(), EXPORTS_DIR);
        await mkdir(exportsPath, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportDir = join(exportsPath, `${imageId}-${timestamp}`);
        await mkdir(exportDir, { recursive: true });
        
        // Save description
        await writeFile(
          join(exportDir, 'description.txt'),
          config.description,
          'utf-8'
        );
        
        // Save config JSON
        await writeFile(
          join(exportDir, 'config.json'),
          JSON.stringify(config, null, 2),
          'utf-8'
        );
        
        // Save base64 image (if available)
        if (imageBase64) {
          await writeFile(
            join(exportDir, 'image.base64.txt'),
            imageBase64,
            'utf-8'
          );
        }
        
        // Save metadata JSON
        await writeFile(
          join(exportDir, 'metadata.json'),
          JSON.stringify({
            imageId,
            timestamp: new Date().toISOString(),
            config,
            imageMimeType: imageFile.mimeType,
            comfyImageFilename,
          }, null, 2),
          'utf-8'
        );
        
        console.log(`Saved export to: ${exportDir}`);
      } catch (error) {
        console.warn('Failed to save export files:', error);
        // Don't fail the request if export saving fails
      }

      // Create workflow using config from JSON
      // Use settings from the config object provided by Ollama
      const workflow = customWorkflow
        ? JSON.parse(customWorkflow)
        : await createComfyUIWorkflow(comfyImageFilename, config.description, {
            checkpoint: config.checkpoint,
            steps: config.steps,
            cfgScale: config.cfgScale,
            denoiseStrength: config.denoiseStrength,
            sampler: config.sampler,
            scheduler: config.scheduler,
            negativePrompt: config.negativePrompt,
            useImageResize: false, // Images are pre-compressed at upload, no resize needed
            useImage: useImage, // Whether to use img2img or txt2img
            width: width,
            height: height,
          });

      // Send initial status
      sendStreamMessage(controller, {
        type: 'status',
        data: 'Submitting workflow to ComfyUI...',
      });

      // Queue the workflow
      const queueResponse = await queueComfyUIWorkflow(workflow);
      const promptId = queueResponse.prompt_id;

      sendStreamMessage(controller, {
        type: 'status',
        data: `Workflow queued (ID: ${promptId})`,
      });

      // Poll for job status
      let lastUpdate: { status: string; progress?: number; imageUrl?: string; error?: string } | null = null;
      let streamOpen = true;
      
      for await (const update of pollComfyUIJob(promptId)) {
        if (!streamOpen) break; // Stop if stream is closed
        
        lastUpdate = update;
        console.log(`[Process Route] Received update:`, { 
          status: update.status, 
          progress: update.progress, 
          hasImageUrl: !!update.imageUrl,
          imageUrl: update.imageUrl 
        });
        
        if (update.status === 'complete') {
          if (update.imageUrl) {
            console.log(`[Process Route] ✅ Job complete! Sending image URL to frontend: ${update.imageUrl}`);
            if (streamOpen) {
              streamOpen = sendStreamMessage(controller, {
                type: 'image',
                data: update.imageUrl,
              });
              if (streamOpen) {
                sendStreamMessage(controller, {
                  type: 'done',
                  data: 'Processing complete',
                });
                closeStream(controller);
              }
            }
            return;
          } else {
            // Job completed but no image URL - try to find it
            console.warn(`[Process Route] Job completed but no imageUrl in update, attempting to find image...`);
            const { findLatestOutputImage } = await import('@/lib/comfyui');
            const foundImage = await findLatestOutputImage(promptId, 'anthroposcenic', Date.now() - 300000); // Check last 5 minutes
            if (foundImage && streamOpen) {
              console.log(`[Process Route] Found image via fallback: ${foundImage.imageUrl}`);
              streamOpen = sendStreamMessage(controller, {
                type: 'image',
                data: foundImage.imageUrl,
              });
              if (streamOpen) {
                sendStreamMessage(controller, {
                  type: 'done',
                  data: 'Processing complete',
                });
                closeStream(controller);
              }
              return;
            } else if (!foundImage && streamOpen) {
              console.error(`[Process Route] Job completed but could not find image file`);
              sendStreamError(controller, 'Processing completed but image not found. Check ComfyUI output directory.');
              return;
            }
          }
        } else if (update.status === 'error') {
          console.error(`[Process Route] ComfyUI error: ${update.error}`);
          if (streamOpen) {
            sendStreamError(controller, update.error || 'ComfyUI processing failed');
          }
          return;
        } else if (update.status === 'timeout') {
          console.error(`[Process Route] ComfyUI timeout`);
          // On timeout, try one final filesystem check
          const { findLatestOutputImage } = await import('@/lib/comfyui');
          const foundImage = await findLatestOutputImage(promptId, 'anthroposcenic', Date.now() - 300000);
          if (foundImage && streamOpen) {
            console.log(`[Process Route] Found image after timeout: ${foundImage.imageUrl}`);
            streamOpen = sendStreamMessage(controller, {
              type: 'image',
              data: foundImage.imageUrl,
            });
            if (streamOpen) {
              sendStreamMessage(controller, {
                type: 'done',
                data: 'Processing complete',
              });
              closeStream(controller);
            }
            return;
          }
          if (streamOpen) {
            sendStreamError(controller, 'ComfyUI processing timed out');
          }
          return;
        } else if (update.progress !== undefined && streamOpen) {
          streamOpen = sendStreamMessage(controller, {
            type: 'progress',
            data: update.progress,
          });
        } else if (streamOpen) {
          streamOpen = sendStreamMessage(controller, {
            type: 'status',
            data: update.status,
          });
        }
      }
      
      // If we exit the loop without a complete status, check one more time
      if (lastUpdate && lastUpdate.status !== 'complete' && streamOpen) {
        console.warn(`[Process Route] Polling loop ended without completion. Last status: ${lastUpdate.status}`);
        const { findLatestOutputImage } = await import('@/lib/comfyui');
        const foundImage = await findLatestOutputImage(promptId, 'anthroposcenic', Date.now() - 300000);
        if (foundImage) {
          console.log(`[Process Route] Found image after polling ended: ${foundImage.imageUrl}`);
          streamOpen = sendStreamMessage(controller, {
            type: 'image',
            data: foundImage.imageUrl,
          });
          if (streamOpen) {
            sendStreamMessage(controller, {
              type: 'done',
              data: 'Processing complete',
            });
            closeStream(controller);
          }
          return;
        }
      }
    } catch (error) {
      console.error('ComfyUI process error:', error);
      sendStreamError(
        controller,
        error instanceof Error ? error.message : 'Failed to process with ComfyUI'
      );
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
