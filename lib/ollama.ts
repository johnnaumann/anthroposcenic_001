import { OllamaResponse } from '@/types';
import { getDefaultOllamaModel, isValidVisionModel } from './models';
import {
  isPromptAtLimit,
  MAX_SD_PROMPT_TAGS,
  MAX_SD_PROMPT_WORDS,
  wouldExceedPromptLimit,
} from './prompt-limits';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
// Use model from config, fallback to env var, then to default
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || getDefaultOllamaModel();

export interface OllamaStreamOptions {
  model?: string;
  prompt: string;
  images?: string[]; // base64 encoded images
  stream?: boolean;
  /** Stop streaming once the response reaches SD prompt limits. */
  capPromptLength?: boolean;
  /** Ollama keep_alive (e.g. 0 to unload the model immediately after this request). */
  keepAlive?: number | string;
}

/**
 * Convert image buffer to base64
 * Note: Ollama expects raw base64 without data URI prefix
 */
export function imageToBase64(buffer: Buffer, mimeType: string): string {
  return buffer.toString('base64');
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
  let model = options.model || OLLAMA_MODEL || getDefaultOllamaModel();
  
  // Ensure we have a valid model name
  if (!model || model === 'default') {
    console.warn('[Ollama] Model is "default" or empty, using default from config:', getDefaultOllamaModel());
    model = getDefaultOllamaModel();
  }
  
  console.log('[Ollama] Using model:', model);
  
  // Validate model if it's provided
  if (options.model && !isValidVisionModel(options.model)) {
    console.warn(`[Ollama] Model ${options.model} not in config, using anyway`);
  }
  const url = `${OLLAMA_HOST}/api/generate`;

    const requestBody = {
      model,
      prompt: options.prompt || '', // Allow empty prompt but default to empty string
      images: options.images || [],
      stream: true,
      // keep_alive: 0 unloads the (10GB) vision model right after describe, freeing
      // unified memory for the Flux generation that follows.
      ...(options.keepAlive !== undefined ? { keep_alive: options.keepAlive } : {}),
    };

    console.log('[Ollama] Request body:', {
      model,
      promptLength: requestBody.prompt.length,
      promptPreview: requestBody.prompt.substring(0, 50),
      imageCount: requestBody.images.length,
      stream: requestBody.stream
    });

    try {
    // First, check if Ollama is available
    const isAvailable = await checkOllamaAvailability();
    if (!isAvailable) {
      throw new Error('Ollama service is not available. Please ensure Ollama is running.');
    }
    
    // Verify the model exists by checking available models
    try {
      const modelsResponse = await fetch(`${OLLAMA_HOST}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        const modelNames = modelsData.models?.map((m: { name: string }) => m.name) || [];
        if (!modelNames.includes(model)) {
          console.warn(`[Ollama] Model "${model}" not found in available models. Available: ${modelNames.slice(0, 5).join(', ')}...`);
          console.warn(`[Ollama] You may need to create the model: npm run ollama:modelfile`);
        } else {
          console.log(`[Ollama] Model "${model}" found in available models`);
        }
      }
    } catch (checkError) {
      console.warn('[Ollama] Could not verify model existence:', checkError);
    }

    // Create abort controller for timeout with longer duration for complex transformations
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout for complex operations

    const response = await fetch(url, {
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
        errorText: errorText.substring(0, 500)
      });
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
    }
    
    console.log('[Ollama] Response OK, reading stream...');

    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;
    let hasReceivedData = false;
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('[Ollama] Stream done. Tokens received:', tokenCount, 'Has data:', hasReceivedData);
        break;
      }

      hasReceivedData = true;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data: OllamaResponse = JSON.parse(line);
            if (data.response) {
              if (options.capPromptLength && wouldExceedPromptLimit(accumulated, data.response)) {
                console.log(
                  `[Ollama] Prompt cap reached (${MAX_SD_PROMPT_WORDS} words / ${MAX_SD_PROMPT_TAGS} tags), stopping stream`
                );
                await reader.cancel();
                return;
              }

              accumulated += data.response;
              tokenCount++;
              yield data.response;

              if (options.capPromptLength && isPromptAtLimit(accumulated)) {
                console.log(
                  `[Ollama] Prompt cap reached (${MAX_SD_PROMPT_WORDS} words / ${MAX_SD_PROMPT_TAGS} tags), stopping stream`
                );
                await reader.cancel();
                return;
              }
            }
            if (data.done) {
              console.log('[Ollama] Stream marked as done. Total tokens:', tokenCount);
              return;
            }
          } catch (e) {
            // Skip invalid JSON lines but log them for debugging
            if (line.length < 200) {
              console.warn('[Ollama] Failed to parse response line:', line);
            } else {
              console.warn('[Ollama] Failed to parse response line (truncated):', line.substring(0, 100) + '...');
            }
          }
        }
      }
    }
    
    if (!hasReceivedData) {
      console.error('[Ollama] No data received from stream. This usually means the model is not responding.');
      throw new Error('No response received from Ollama. The model may not exist or may not be responding. Please verify the model exists: ollama list');
    }
    
    if (tokenCount === 0) {
      console.error('[Ollama] Stream completed but no tokens were yielded.');
      throw new Error('Ollama stream completed but returned no tokens. The model may not be responding correctly. Try recreating the model: npm run ollama:modelfile');
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
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - Ollama took too long to respond. The operation may be too complex or Ollama may be overloaded.');
    }
    throw error;
  }
}

