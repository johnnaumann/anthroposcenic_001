import { getDefaultOllamaModel, isValidVisionModel } from './models';
import { readOllamaResponseStream } from '@/lib/ollama-stream';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || getDefaultOllamaModel();

export interface OllamaStreamOptions {
  model?: string;
  prompt: string;
  images?: string[];
  stream?: boolean;
  capPromptLength?: boolean;
  keepAlive?: number | string;
}

export function imageToBase64(buffer: Buffer, mimeType: string): string {
  return buffer.toString('base64');
}

async function checkOllamaAvailability(): Promise<boolean> {
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

function resolveOllamaModel(requestedModel?: string): string {
  let model = requestedModel || OLLAMA_MODEL || getDefaultOllamaModel();
  if (!model || model === 'default') {
    console.warn('[Ollama] Model is "default" or empty, using default from config:', getDefaultOllamaModel());
    model = getDefaultOllamaModel();
  }
  console.log('[Ollama] Using model:', model);
  if (requestedModel && !isValidVisionModel(requestedModel)) {
    console.warn(`[Ollama] Model ${requestedModel} not in config, using anyway`);
  }
  return model;
}

async function verifyOllamaModel(model: string): Promise<void> {
  try {
    const modelsResponse = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!modelsResponse.ok) return;

    const modelsData = await modelsResponse.json();
    const modelNames = modelsData.models?.map((m: { name: string }) => m.name) || [];
    if (!modelNames.includes(model)) {
      console.warn(
        `[Ollama] Model "${model}" not found in available models. Available: ${modelNames.slice(0, 5).join(', ')}...`
      );
      console.warn('[Ollama] You may need to pull the model: npm run setup:ollama');
      return;
    }
    console.log(`[Ollama] Model "${model}" found in available models`);
  } catch (checkError) {
    console.warn('[Ollama] Could not verify model existence:', checkError);
  }
}

export async function* streamOllamaResponse(
  options: OllamaStreamOptions
): AsyncGenerator<string, void, unknown> {
  const model = resolveOllamaModel(options.model);
  const requestBody = {
    model,
    prompt: options.prompt || '',
    images: options.images || [],
    stream: true,
    ...(options.keepAlive !== undefined ? { keep_alive: options.keepAlive } : {}),
  };

  console.log('[Ollama] Request body:', {
    model,
    promptLength: requestBody.prompt.length,
    promptPreview: requestBody.prompt.substring(0, 50),
    imageCount: requestBody.images.length,
    stream: requestBody.stream,
  });

  try {
    const isAvailable = await checkOllamaAvailability();
    if (!isAvailable) {
      throw new Error('Ollama service is not available. Please ensure Ollama is running.');
    }

    await verifyOllamaModel(model);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000);

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[Ollama] API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
      });
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`
      );
    }

    console.log('[Ollama] Response OK, reading stream...');
    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    yield* readOllamaResponseStream(response.body, options.capPromptLength === true);
  } catch (error) {
    console.error('Ollama streaming error:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'Request timeout - Ollama took too long to respond. The operation may be too complex or Ollama may be overloaded.'
      );
    }
    throw error;
  }
}
