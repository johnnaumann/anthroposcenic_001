import { NextRequest } from 'next/server';
import { readFile, copyFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { queueComfyUIWorkflow, pollComfyUIJob, createComfyUIWorkflow, checkComfyUIAvailability, prepareImageForComfyUI } from '@/lib/comfyui';
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
      // Check ComfyUI availability
      const isAvailable = await checkComfyUIAvailability();
      if (!isAvailable) {
        sendStreamError(controller, 'ComfyUI service is not available');
        return;
      }

      const body: ComfyUIProcessRequest = await request.json();
      const { imageId, description, workflow: customWorkflow } = body;

      if (!imageId || !description) {
        sendStreamError(controller, 'Image ID and description are required');
        return;
      }

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

      let comfyImageFilename: string;
      let imageBase64: string;
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
          description,
          'utf-8'
        );
        
        // Save base64 image
        await writeFile(
          join(exportDir, 'image.base64.txt'),
          imageBase64,
          'utf-8'
        );
        
        // Save metadata JSON
        await writeFile(
          join(exportDir, 'metadata.json'),
          JSON.stringify({
            imageId,
            timestamp: new Date().toISOString(),
            description,
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

      // Create or use custom workflow
      // The workflow is built programmatically with all nodes and connections
      // Images are now pre-compressed at upload, so no need for resize node
      // Use creativity settings from environment or defaults
      // Default to 'vivid' for vivid, high-quality images
      const creativity = (process.env.COMFYUI_CREATIVITY as 'low' | 'medium' | 'high' | 'extreme' | 'quality' | 'quality-high' | 'vivid') || 'vivid';
      const customSteps = process.env.COMFYUI_STEPS ? parseInt(process.env.COMFYUI_STEPS, 10) : undefined;
      const customCfgScale = process.env.COMFYUI_CFG_SCALE ? parseFloat(process.env.COMFYUI_CFG_SCALE) : undefined;
      const customDenoise = process.env.COMFYUI_DENOISE ? parseFloat(process.env.COMFYUI_DENOISE) : undefined;
      const customSampler = process.env.COMFYUI_SAMPLER || undefined;
      const customScheduler = process.env.COMFYUI_SCHEDULER || undefined;
      const customCheckpoint = process.env.COMFYUI_CHECKPOINT || undefined;
      
      const workflow = customWorkflow
        ? JSON.parse(customWorkflow)
        : await createComfyUIWorkflow(comfyImageFilename, description, {
            checkpoint: customCheckpoint,
            creativity,
            steps: customSteps,
            cfgScale: customCfgScale,
            denoiseStrength: customDenoise,
            sampler: customSampler,
            scheduler: customScheduler,
            useImageResize: false, // Images are pre-compressed at upload, no resize needed
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
