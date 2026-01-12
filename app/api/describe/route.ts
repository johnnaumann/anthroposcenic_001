import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { streamOllamaResponse, imageToBase64, generateDescriptionPrompt } from '@/lib/ollama';
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

      // Generate description prompt
      const prompt = generateDescriptionPrompt();

      // Stream response from Ollama
      let fullDescription = '';
      let streamOpen = true;
      
      try {
        for await (const token of streamOllamaResponse({
          model,
          prompt,
          images: [imageBase64],
          stream: true,
        })) {
          fullDescription += token;
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

        // Send completion message only if stream is still open
        if (streamOpen) {
          sendStreamMessage(controller, {
            type: 'done',
            data: fullDescription,
          });
          closeStream(controller);
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
