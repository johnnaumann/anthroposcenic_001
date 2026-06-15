import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { streamOllamaResponse, imageToBase64 } from '@/lib/ollama';
import { sendStreamMessage, sendStreamError, closeStream } from '@/lib/streaming';
import { ComfyUIConfig } from '@/types';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

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
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
  });

  // Process asynchronously
  (async () => {
    try {
      const body = await request.json();
      const { imageId, originalDescription, model } = body;

      console.log('[Transform] Received request:', { 
        imageId, 
        hasDescription: !!originalDescription,
        descriptionLength: originalDescription?.length || 0,
        descriptionPreview: originalDescription?.substring(0, 100) || 'none'
      });

      if (!imageId || !originalDescription) {
        const errorMsg = !imageId 
          ? 'Image ID is required' 
          : 'Original description is required';
        console.error('[Transform] Missing required field:', errorMsg);
        sendStreamError(controller, errorMsg);
        return;
      }

      // Find and read the image file
      const imageFile = await findImageFile(imageId);
      if (!imageFile) {
        sendStreamError(controller, 'Image not found');
        return;
      }

      const imageBuffer = await readFile(imageFile.path);
      const imageBase64 = imageToBase64(imageBuffer, imageFile.mimeType);

      // System prompt is in the modelfile - pass only the data (original description) to transform
      // No prompt instructions in TypeScript - all instructions are in the modelfile
      const prompt = originalDescription;

      // Stream response from Ollama with timeout handling
      let transformedDescription = '';
      let streamOpen = true;
      let lastTokenTime = Date.now();
      const TIMEOUT_MS = 600000; // 10 minutes total timeout
      const STREAM_TIMEOUT_MS = 120000; // 2 minutes without tokens = timeout
      
      try {
        const streamStartTime = Date.now();
        
        // Use transform model if available, otherwise fallback to default
        const transformModel = model || process.env.OLLAMA_TRANSFORM_MODEL || process.env.OLLAMA_MODEL || 'anthroposcenic-transform:latest';
        
        for await (const token of streamOllamaResponse({
          model: transformModel,
          prompt,
          images: [imageBase64],
          stream: true,
        })) {
          // Check for overall timeout
          if (Date.now() - streamStartTime > TIMEOUT_MS) {
            throw new Error('Transformation timeout: Operation took too long');
          }
          
          lastTokenTime = Date.now();
          transformedDescription += token;
          
          // Only send if stream is still open
          if (streamOpen) {
            streamOpen = sendStreamMessage(controller, {
              type: 'token',
              data: token,
            });
            // If stream closed, stop trying to send
            if (!streamOpen) {
              console.warn('[Transform] Stream closed during token streaming');
              break;
            }
          }
        }
        
        // Check if we got stuck (no tokens for too long)
        if (Date.now() - lastTokenTime > STREAM_TIMEOUT_MS && transformedDescription.length === 0) {
          throw new Error('Transformation timeout: No response received from Ollama');
        }

        // Send completion message only if stream is still open
        if (streamOpen && transformedDescription.trim()) {
          sendStreamMessage(controller, {
            type: 'done',
            data: transformedDescription.trim(),
          });
          closeStream(controller);
        } else if (streamOpen && !transformedDescription.trim()) {
          sendStreamError(controller, 'Failed to generate transformed description');
        }
      } catch (streamError) {
        // If streaming fails but stream is still open, send error
        if (streamOpen) {
          console.error('Transform streaming error:', streamError);
          sendStreamError(
            controller,
            streamError instanceof Error ? streamError.message : 'Failed to transform description'
          );
        } else {
          // Stream already closed, just log
          console.error('Transform error after stream closed:', streamError);
        }
      }
    } catch (error) {
      console.error('Transform error:', error);
      try {
        sendStreamError(
          controller,
          error instanceof Error ? error.message : 'Failed to transform description'
        );
      } catch (sendError) {
        console.error('Failed to send error message (stream may be closed):', sendError);
      }
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
