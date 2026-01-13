import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { streamOllamaResponse, imageToBase64 } from '@/lib/ollama';
import { sendStreamMessage, sendStreamError, closeStream } from '@/lib/streaming';
import { DescribeRequest } from '@/types';

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
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
  });

  // Process asynchronously
  (async () => {
    try {
      const body: DescribeRequest = await request.json();
      const { imageId, model } = body;

      if (!imageId) {
        sendStreamError(controller, 'Image ID is required');
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

      // System prompt is in the modelfile - use minimal trigger (not an instruction)
      // The modelfile system prompt contains all instructions for JSON generation
      // Use the custom model if no model specified, fallback to default from config
      let modelToUse = model;
      if (!modelToUse || modelToUse === 'default') {
        modelToUse = process.env.OLLAMA_MODEL || 'anthroposcenic-describe:latest';
      }
      
      console.log('[Describe] Using model:', modelToUse);
      console.log('[Describe] Model from request:', model || 'not provided (will use default)');
      console.log('[Describe] OLLAMA_MODEL env:', process.env.OLLAMA_MODEL || 'not set');
      console.log('[Describe] Final model selected:', modelToUse);
      
      let fullResponse = '';
      let streamOpen = true;
      
      try {
        let tokenCount = 0;
        
        // System prompt in modelfile handles instructions - just use minimal trigger
        const prompt = 'Describe';
        
        console.log('[Describe] Sending request to Ollama');
        
        for await (const token of streamOllamaResponse({
          model: modelToUse,
          prompt: prompt,
          images: [imageBase64],
          stream: true,
        })) {
          tokenCount++;
          fullResponse += token;
          // Only send if stream is still open
          if (streamOpen) {
            streamOpen = sendStreamMessage(controller, {
              type: 'token',
              data: token,
            });
            // If stream closed, stop trying to send
            if (!streamOpen) {
              console.warn('[Describe] Stream closed during token streaming');
              break;
            }
          }
        }

        console.log('[Describe] Stream completed. Token count:', tokenCount, 'Response length:', fullResponse.length);

        // Check if we got any response
        if (!fullResponse || fullResponse.trim().length === 0) {
          throw new Error('Empty response from Ollama. The model may not be responding correctly. Please ensure the model is created and Ollama is running.');
        }

        // Clean the response - remove any markdown or extra formatting
        let description = fullResponse.trim();
        description = description.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
        description = description.replace(/^#{1,6}\s+/gm, '');
        description = description.trim();

        // Send completion message with description text
        if (streamOpen && description) {
          console.log('[Describe] Sending done message with description');
          const sent = sendStreamMessage(controller, {
            type: 'done',
            data: description,
          });
          if (sent) {
            closeStream(controller);
            console.log('[Describe] Stream closed successfully');
          } else {
            console.warn('[Describe] Failed to send done message - stream already closed');
          }
        } else {
          if (!streamOpen) {
            console.warn('[Describe] Cannot send completion - stream already closed');
          }
          if (!description) {
            console.error('[Describe] Cannot send completion - no description received');
            if (streamOpen) {
              sendStreamError(controller, 'Failed to generate description. Please check server logs for details.');
            }
          }
        }
      } catch (streamError) {
        // If streaming fails but stream is still open, send error
        if (streamOpen) {
          console.error('Describe streaming error:', streamError);
          sendStreamError(
            controller,
            streamError instanceof Error ? streamError.message : 'Failed to generate description'
          );
        } else {
          // Stream already closed, just log
          console.error('Describe error after stream closed:', streamError);
        }
      }
    } catch (error) {
      console.error('Describe error:', error);
      // Only send error if stream is still open
      try {
        sendStreamError(
          controller,
          error instanceof Error ? error.message : 'Failed to generate description'
        );
      } catch (sendError) {
        // Stream might already be closed, just log
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
