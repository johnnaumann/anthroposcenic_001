import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { streamOllamaResponse, imageToBase64 } from '@/lib/ollama';
import { truncatePromptAtLimit } from '@/lib/prompt-limits';
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
      const { imageId, imageIds, model } = body;

      // One or many sources: `imageIds` (blend several pieces into one imagined
      // work) takes precedence; `imageId` is the single-image path.
      const sourceIds = (imageIds && imageIds.length > 0 ? imageIds : imageId ? [imageId] : [])
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      if (sourceIds.length === 0) {
        if (controller) {
          sendStreamError(controller, 'Image ID is required');
        }
        return;
      }

      // Read every source image to base64.
      const imagesBase64: string[] = [];
      for (const id of sourceIds) {
        const imageFile = await findImageFile(id);
        if (!imageFile) {
          if (controller) {
            sendStreamError(controller, 'Image not found');
          }
          return;
        }
        const imageBuffer = await readFile(imageFile.path);
        imagesBase64.push(imageToBase64(imageBuffer, imageFile.mimeType));
      }

      const isBlend = imagesBase64.length > 1;

      // Free ComfyUI's GPU/unified memory before loading the vision model. On Apple
      // Silicon (MPS) ComfyUI keeps its models resident after a generation, which can
      // starve Ollama and wedge this step. Best-effort — ComfyUI may not be running.
      try {
        const comfyHost = process.env.COMFYUI_HOST || 'http://localhost:8188';
        await fetch(`${comfyHost}/free`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unload_models: true, free_memory: true }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        /* ComfyUI not running or unreachable — nothing to free */
      }

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
        
        // Rich, nuanced read of the artwork. Flux's T5 encoder thrives on natural
        // language, and a vivid description of style/mood/technique gives the model
        // far more to "acknowledge and riff on" than a flat list of tags.
        const prompt = isBlend
          ? 'You are an art critic and prompt engineer. You are shown several artworks. Imagine a single ' +
            'NEW artwork that fuses their styles, moods, colour palettes, forms and techniques into one ' +
            'cohesive, original piece — a synthesis, not a description of any one of them. In flowing natural ' +
            'language, write one vivid image-generation prompt for this imagined fusion: its overall style ' +
            'and medium; the mood and atmosphere; the composition, forms and movement; the colour palette ' +
            'and materials; the texture and mark-making. Be specific and evocative, and lean into the ' +
            'unexpected combinations between the works. Then finish with a short comma-separated list of key ' +
            'style descriptors. Write 2-4 sentences followed by the tags. No preamble, no markdown, no ' +
            'headings, no quotation marks.'
          : 'You are an art critic and prompt engineer. Study this artwork closely and write a single, ' +
            'vivid image-generation prompt that captures its essence so an AI can reinterpret and riff on it. ' +
            'In flowing natural language, describe: the overall style and medium; the mood and atmosphere; ' +
            'the composition, forms and sense of movement; the colour palette and materials; the texture, ' +
            'mark-making and technique; and what makes it distinctive. Be specific and evocative — capture ' +
            'nuance, not just a list of objects. Then finish with a short comma-separated list of key style ' +
            'descriptors. Write 2-4 sentences followed by the tags. No preamble, no markdown, no headings, ' +
            'no quotation marks.';
        
        console.log('[Describe] Sending request to Ollama');
        
        for await (const token of streamOllamaResponse({
          model: modelToUse,
          prompt: prompt,
          images: imagesBase64,
          stream: true,
          capPromptLength: true,
          keepAlive: 0, // unload the vision model right after, freeing memory for Flux
        })) {
          tokenCount++;
          fullResponse += token;
          // Only send if stream is still open
          if (streamOpen && controller) {
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

        // Clean the response - strip any <think> reasoning block (qwen3-vl), markdown, etc.
        let raw = fullResponse.trim().replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        let description = truncatePromptAtLimit(raw);
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
