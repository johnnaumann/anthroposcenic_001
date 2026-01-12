import { OllamaResponse } from '@/types';
import { getDefaultOllamaModel, isValidVisionModel } from './models';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
// Use model from config, fallback to env var, then to default
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || getDefaultOllamaModel();

export interface OllamaStreamOptions {
  model?: string;
  prompt: string;
  images?: string[]; // base64 encoded images
  stream?: boolean;
}

/**
 * Convert image buffer to base64
 */
export function imageToBase64(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Check if Ollama service is available
 */
export async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch (error) {
    console.error('Ollama availability check failed:', error);
    return false;
  }
}

/**
 * Stream response from Ollama API
 */
export async function* streamOllamaResponse(
  options: OllamaStreamOptions
): AsyncGenerator<string, void, unknown> {
  // Use provided model, or fallback to configured default
  let model = options.model || OLLAMA_MODEL;
  
  // Validate model if it's provided
  if (options.model && !isValidVisionModel(options.model)) {
    console.warn(`Model ${options.model} not in config, using anyway`);
  }
  const url = `${OLLAMA_HOST}/api/generate`;

  const requestBody = {
    model,
    prompt: options.prompt,
    images: options.images || [],
    stream: true,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data: OllamaResponse = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }
            if (data.done) {
              return;
            }
          } catch (e) {
            // Skip invalid JSON lines
            console.warn('Failed to parse Ollama response line:', line);
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const data: OllamaResponse = JSON.parse(buffer);
        if (data.response) {
          yield data.response;
        }
      } catch (e) {
        console.warn('Failed to parse final Ollama response:', buffer);
      }
    }
  } catch (error) {
    console.error('Ollama streaming error:', error);
    throw error;
  }
}

/**
 * Generate description prompt for image
 */
export function generateDescriptionPrompt(): string {
  return `Describe this image in detail, focusing on visual elements, composition, colors, objects, people, and any text visible. Provide a comprehensive description that could be used to generate or modify this image using an AI image generation system like ComfyUI. Be specific about:
- Main subjects and objects
- Colors and lighting
- Composition and layout
- Style and mood
- Any text or symbols visible
- Background elements

Description:`;
}
