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
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      console.log('[Describe] Stream cancelled by client');
      controller = null;
    },
  });

  // Process asynchronously
  (async () => {
    try {
      const body: DescribeRequest = await request.json();
      const { imageId, model } = body;

      if (!imageId) {
        if (controller) {
          sendStreamError(controller, 'Image ID is required');
        }
        return;
      }

      // Find and read the image file
      const imageFile = await findImageFile(imageId);
      if (!imageFile) {
        if (controller) {
          sendStreamError(controller, 'Image not found');
        }
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
        
        // Steer the model to emit a Stable Diffusion-style prompt rather than prose.
        // Diffusion text encoders key on front-loaded, comma-separated visual tokens,
        // so this produces a far stronger conditioning signal than full sentences.
        // (When using the custom anthroposcenic-describe model, its modelfile SYSTEM
        // prompt says the same thing; this keeps the raw-model path aligned too.)
        const prompt =
          'Write a single Stable Diffusion image prompt that recreates and enriches this image. ' +
          'Output ONLY a comma-separated list of concrete visual tags, most important first: ' +
          'main subject and key objects, then setting/background, composition and camera angle, ' +
          'lighting, dominant colors and materials, textures, and overall art style or medium. ' +
          'Be specific and vivid. No full sentences, no explanations, no quotation marks, no preamble. ' +
          'Aim for 30-60 descriptive tags.';
        
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
            const wasSent = sendStreamMessage(controller, {
              type: 'token',
              data: token,
            });
            // If stream closed, log but continue collecting tokens
            // Don't break - we still want to process the full response
            if (!wasSent) {
              console.warn('[Describe] Stream closed during token streaming, but continuing to collect response');
              streamOpen = false;
              // Don't break - continue to collect the full response for completion message
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
        if (description && description.trim()) {
          console.log('[Describe] Attempting to send done message with description, length:', description.length);
          if (controller) {
            const sent = sendStreamMessage(controller, {
              type: 'done',
              data: description,
            });
            if (sent) {
              closeStream(controller);
              console.log('[Describe] Stream closed successfully');
            } else {
              console.warn('[Describe] Failed to send done message - stream already closed by client');
            }
          } else {
            console.warn('[Describe] Controller is null - stream was cancelled');
          }
        } else {
          console.error('[Describe] Cannot send completion - no description received. Full response:', fullResponse.substring(0, 100));
          if (controller && streamOpen) {
            sendStreamError(controller, 'Failed to generate description. Please check server logs for details.');
          }
        }
      } catch (streamError) {
        // If streaming fails but stream is still open, send error
        if (streamOpen && controller) {
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
      // Only send error if stream is still open and controller exists
      if (controller) {
        try {
          sendStreamError(
            controller,
            error instanceof Error ? error.message : 'Failed to generate description'
          );
        } catch (sendError) {
          // Stream might already be closed, just log
          console.error('Failed to send error message (stream may be closed):', sendError);
        }
      } else {
        console.warn('Cannot send error - controller is null (stream was cancelled)');
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
