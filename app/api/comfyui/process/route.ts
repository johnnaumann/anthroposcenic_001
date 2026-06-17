import { NextRequest } from 'next/server';
import { readFile, copyFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { queueComfyUIWorkflow, pollComfyUIJob, createComfyUIWorkflow, checkComfyUIAvailability, isFluxModel } from '@/lib/comfyui';
import { startComfyUI } from '@/lib/comfyui-startup';
import { ensureCheckpoint, isCorruptionError, checkpointExists, checkpointAppearsValid } from '@/lib/model-downloader';
import { resolveUploadDir } from '@/lib/project-paths';
import { sendStreamMessage, sendStreamError, closeStream } from '@/lib/streaming';
import { ComfyUIProcessRequest } from '@/types';
import { createProgressAggregator, getSamplingPhases } from '@/lib/processing-progress';

async function findImageFile(imageId: string): Promise<{ path: string; mimeType: string } | null> {
  const uploadPath = resolveUploadDir();
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
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
  });

  // Process asynchronously
  (async () => {
    let streamOpen = true;

    try {
      let body: ComfyUIProcessRequest;
      try {
        const rawBody = await request.text();
        if (!rawBody.trim()) {
          // Client aborted before the body was sent — nothing to do.
          closeStream(controller);
          return;
        }
        body = JSON.parse(rawBody) as ComfyUIProcessRequest;
      } catch {
        sendStreamError(controller, 'Invalid request body');
        return;
      }

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
        sendStreamError(controller, 'Failed to start ComfyUI. Please ensure ComfyUI is set up: npm run setup:comfyui');
        return;
      }

      const isFlux = isFluxModel(config.checkpoint);

      // Ensure the model is available. Flux GGUF lives in models/unet and is loaded by
      // UnetLoaderGGUF, so it skips this checkpoints/ download+validate gate (ComfyUI
      // validates it at submit time). SD1.5/SDXL checkpoints still go through the gate.
      if (isFlux) {
        sendStreamMessage(controller, {
          type: 'status',
          data: `Using Flux model: ${config.checkpoint}`,
        });
      } else {
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
      
      // Validate that the checkpoint file appears valid (not corrupted)
      if (!checkpointAppearsValid(config.checkpoint)) {
        console.warn(`[ComfyUI Process] ⚠️  Model file "${config.checkpoint}" exists but appears invalid (too small). Attempting to re-download...`);
        
        if (streamOpen) {
          sendStreamMessage(controller, {
            type: 'status',
            data: `Model file appears corrupted. Re-downloading...`,
          });
        }
        
        try {
          // Delete the corrupted file
          const CHECKPOINTS_DIR = join(process.cwd(), 'comfyui', 'models', 'checkpoints');
          const corruptedFilePath = join(CHECKPOINTS_DIR, config.checkpoint);
          await unlink(corruptedFilePath);
          console.log(`[ComfyUI Process] ✅ Deleted corrupted file`);
          
          // Re-download
          const reDownloaded = await ensureCheckpoint(config.checkpoint, (progress) => {
            if (typeof progress === 'number' && progress <= 100) {
              const progressPercent = Math.round(progress);
              if (streamOpen) {
                sendStreamMessage(controller, {
                  type: 'status',
                  data: `Re-downloading model: ${progressPercent}%`,
                });
              }
            } else {
              const mb = ((progress as number) / (1024 * 1024)).toFixed(2);
              if (streamOpen) {
                sendStreamMessage(controller, {
                  type: 'status',
                  data: `Re-downloading model: ${mb} MB downloaded...`,
                });
              }
            }
          }, true);
          
          if (!reDownloaded) {
            const errorMsg = `Failed to re-download model "${config.checkpoint}". Please download it manually.`;
            console.error(`[ComfyUI Process] ${errorMsg}`);
            if (streamOpen) {
              sendStreamError(controller, errorMsg);
            }
            return;
          }
          
          console.log(`[ComfyUI Process] ✅ Model re-downloaded successfully`);
        } catch (error) {
          console.error(`[ComfyUI Process] Error re-downloading model:`, error);
          if (streamOpen) {
            sendStreamError(controller, `Failed to re-download corrupted model "${config.checkpoint}". Please delete it manually and try again.`);
          }
          return;
        }
      }
      } // end if (!isFlux) — Flux GGUF skips the checkpoints/ gate

      console.log(`[ComfyUI Process] ✅ Model ready: ${config.checkpoint}`);
      console.log(`[ComfyUI Process] Mode: ${useImage ? 'img2img' : 'txt2img'}`);

      let comfyImageFilename: string | null = null;

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
          const extension = imageFile.path.split('.').pop() || 'png';
          const filename = `${imageId}.${extension}`;
          const comfyImagePath = join(comfyInputDir, filename);
          
          await copyFile(imageFile.path, comfyImagePath);
          comfyImageFilename = filename;
        } catch (error) {
          console.warn('Failed to copy image to ComfyUI input, using filename:', error);
          // Fallback: use just the filename (assumes image is accessible)
          comfyImageFilename = imageFile.path.split('/').pop() || `${imageId}.png`;
        }
      } else {
        sendStreamMessage(controller, {
          type: 'status',
          data: 'Using text-to-image mode (no input image)...',
        });
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
            // Detail & refinement (undefined → workflow uses its own defaults)
            hiresFix: config.hiresFix,
            hiresFactor: config.hiresFactor,
            hiresDenoise: config.hiresDenoise,
            controlNet: config.controlNet,
            controlNetStrength: config.controlNetStrength,
            freeU: config.freeU,
            qualityBoost: config.qualityBoost,
          });

      // Send initial status
      sendStreamMessage(controller, {
        type: 'status',
        data: 'Submitting workflow to ComfyUI...',
      });

      // Queue the workflow
      const queueResponse = await queueComfyUIWorkflow(workflow);
      const promptId = queueResponse.prompt_id;
      const jobStartTime = Date.now();

      sendStreamMessage(controller, {
        type: 'meta',
        data: { promptId, jobStartTime },
      });

      sendStreamMessage(controller, {
        type: 'status',
        data: `Workflow queued (ID: ${promptId})`,
      });

      // Poll for job status
      let lastUpdate: import('@/types').ComfyUIProgressUpdate | null = null;
      const progressAggregator = createProgressAggregator(getSamplingPhases(config));
      
      for await (const update of pollComfyUIJob(promptId)) {
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
            return;
          } else {
            // Job completed but no image URL - try to find it
            console.warn(`[Process Route] Job completed but no imageUrl in update, attempting to find image...`);
            const { findLatestOutputImage } = await import('@/lib/comfyui');
            const foundImage = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
            if (foundImage) {
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
            } else if (streamOpen) {
              console.error(`[Process Route] Job completed but could not find image file`);
              sendStreamError(controller, 'Processing completed but image not found. Check ComfyUI output directory.');
              return;
            }
          }
        } else if (update.status === 'error') {
          console.error(`[Process Route] ComfyUI error: ${update.error}`);
          
          // Check if error is due to corrupted model file
          const errorMessage = update.error || '';
          if (isCorruptionError(errorMessage)) {
            console.log(`[Process Route] Detected corrupted model: ${config.checkpoint}`);
            
            // Try to automatically fix by re-downloading
            if (streamOpen) {
              sendStreamMessage(controller, {
                type: 'status',
                data: `Model file "${config.checkpoint}" is corrupted. Attempting to re-download...`,
              });
            }
            
            try {
              // Delete the corrupted file
              const CHECKPOINTS_DIR = join(process.cwd(), 'comfyui', 'models', 'checkpoints');
              const corruptedFilePath = join(CHECKPOINTS_DIR, config.checkpoint);
              
              if (checkpointExists(config.checkpoint)) {
                console.log(`[Process Route] Deleting corrupted file: ${corruptedFilePath}`);
                await unlink(corruptedFilePath);
                console.log(`[Process Route] ✅ Deleted corrupted file`);
              }
              
              // Re-download the model
              if (streamOpen) {
                sendStreamMessage(controller, {
                  type: 'status',
                  data: `Re-downloading model: ${config.checkpoint}...`,
                });
              }
              
              const checkpointReady = await ensureCheckpoint(config.checkpoint, (progress) => {
                if (typeof progress === 'number' && progress <= 100) {
                  const progressPercent = Math.round(progress);
                  if (streamOpen) {
                    sendStreamMessage(controller, {
                      type: 'status',
                      data: `Re-downloading model: ${progressPercent}%`,
                    });
                  }
                  console.log(`[ComfyUI Process] Re-download progress: ${progressPercent}%`);
                } else {
                  const mb = ((progress as number) / (1024 * 1024)).toFixed(2);
                  if (streamOpen) {
                    sendStreamMessage(controller, {
                      type: 'status',
                      data: `Re-downloading model: ${mb} MB downloaded...`,
                    });
                  }
                  console.log(`[ComfyUI Process] Re-download progress: ${mb} MB`);
                }
              }, true); // Force re-download
              
              if (checkpointReady) {
                console.log(`[Process Route] ✅ Model re-downloaded successfully: ${config.checkpoint}`);
                if (streamOpen) {
                  sendStreamMessage(controller, {
                    type: 'status',
                    data: `Model re-downloaded successfully. Please try processing again.`,
                  });
                  sendStreamError(controller, `Model "${config.checkpoint}" was corrupted and has been re-downloaded. Please try processing your image again.`);
                }
              } else {
                const errorMsg = `Failed to re-download model "${config.checkpoint}". Please download it manually to: comfyui/models/checkpoints/`;
                console.error(`[Process Route] ${errorMsg}`);
                if (streamOpen) {
                  sendStreamError(controller, errorMsg);
                }
              }
            } catch (redownloadError) {
              console.error(`[Process Route] Error during model re-download:`, redownloadError);
              const errorMsg = `Model file "${config.checkpoint}" is corrupted. Failed to automatically re-download. Please delete the file manually and try again:\n\n` +
                `1. Delete: comfyui/models/checkpoints/${config.checkpoint}\n` +
                `2. Try processing again (it will auto-download), or\n` +
                `3. Download manually from Hugging Face`;
              if (streamOpen) {
                sendStreamError(controller, errorMsg);
              }
            }
            return;
          }
          
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
          const snapshot = progressAggregator.update(
            update.progress,
            update.step,
            update.stepMax
          );
          streamOpen = sendStreamMessage(controller, {
            type: 'progress',
            data: snapshot,
          });
        } else if (update.executionComplete && streamOpen) {
          const snapshot = progressAggregator.complete();
          streamOpen = sendStreamMessage(controller, {
            type: 'progress',
            data: snapshot,
          });
        } else if (streamOpen) {
          streamOpen = sendStreamMessage(controller, {
            type: 'status',
            data: update.status,
          });
        }
      }
      
      // If we exit the loop without a complete status, check one more time
      if (lastUpdate && lastUpdate.status !== 'complete') {
        console.warn(`[Process Route] Polling loop ended without completion. Last status: ${lastUpdate.status}`);
        const { findLatestOutputImage } = await import('@/lib/comfyui');
        const foundImage = await findLatestOutputImage(promptId, 'anthroposcenic', jobStartTime);
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
