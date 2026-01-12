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
      const workflow = customWorkflow
        ? JSON.parse(customWorkflow)
        : await createComfyUIWorkflow(comfyImageFilename, description, {
            steps: 15, // Reduced from 20 for memory optimization
            cfgScale: 7.0,
            denoiseStrength: 0.75,
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
      for await (const update of pollComfyUIJob(promptId)) {
        if (update.status === 'complete' && update.imageUrl) {
          sendStreamMessage(controller, {
            type: 'image',
            data: update.imageUrl,
          });
          sendStreamMessage(controller, {
            type: 'done',
            data: 'Processing complete',
          });
          closeStream(controller);
          return;
        } else if (update.status === 'error') {
          sendStreamError(controller, update.error || 'ComfyUI processing failed');
          return;
        } else if (update.status === 'timeout') {
          sendStreamError(controller, 'ComfyUI processing timed out');
          return;
        } else if (update.progress !== undefined) {
          sendStreamMessage(controller, {
            type: 'progress',
            data: update.progress,
          });
        } else {
          sendStreamMessage(controller, {
            type: 'status',
            data: update.status,
          });
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
