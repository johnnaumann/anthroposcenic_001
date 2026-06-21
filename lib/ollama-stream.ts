import { OllamaResponse } from '@/types';
import {
  isPromptAtLimit,
  MAX_SD_PROMPT_TAGS,
  MAX_SD_PROMPT_WORDS,
  wouldExceedPromptLimit,
} from '@/lib/prompt-limits';

type OllamaLineResult =
  | { type: 'token'; token: string }
  | { type: 'done' }
  | { type: 'capped' };

function logPromptCapReached(): void {
  console.log(
    `[Ollama] Prompt cap reached (${MAX_SD_PROMPT_WORDS} words / ${MAX_SD_PROMPT_TAGS} tags), stopping stream`
  );
}

function parseOllamaStreamLine(line: string, accumulated: string, capPromptLength: boolean): OllamaLineResult | null {
  try {
    const data: OllamaResponse = JSON.parse(line);
    if (data.response) {
      if (capPromptLength && wouldExceedPromptLimit(accumulated, data.response)) {
        logPromptCapReached();
        return { type: 'capped' };
      }

      const nextAccumulated = accumulated + data.response;
      if (capPromptLength && isPromptAtLimit(nextAccumulated)) {
        logPromptCapReached();
        return { type: 'capped' };
      }

      return { type: 'token', token: data.response };
    }
    if (data.done) {
      return { type: 'done' };
    }
  } catch {
    if (line.length < 200) {
      console.warn('[Ollama] Failed to parse response line:', line);
    } else {
      console.warn('[Ollama] Failed to parse response line (truncated):', `${line.substring(0, 100)}...`);
    }
  }

  return null;
}

function assertOllamaStreamProducedTokens(hasReceivedData: boolean, tokenCount: number): void {
  if (!hasReceivedData) {
    console.error('[Ollama] No data received from stream. This usually means the model is not responding.');
    throw new Error(
      'No response received from Ollama. The model may not exist or may not be responding. Please verify the model exists: ollama list'
    );
  }

  if (tokenCount === 0) {
    console.error('[Ollama] Stream completed but no tokens were yielded.');
    throw new Error(
      'Ollama stream completed but returned no tokens. The model may not be responding correctly. Try: npm run setup:ollama'
    );
  }
}

export async function* readOllamaResponseStream(
  body: ReadableStream<Uint8Array>,
  capPromptLength: boolean
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
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
      if (!line.trim()) continue;

      const parsed = parseOllamaStreamLine(line, accumulated, capPromptLength);
      if (!parsed) continue;

      if (parsed.type === 'capped') {
        await reader.cancel();
        return;
      }
      if (parsed.type === 'done') {
        console.log('[Ollama] Stream marked as done. Total tokens:', tokenCount);
        return;
      }

      accumulated += parsed.token;
      tokenCount++;
      yield parsed.token;
    }
  }

  assertOllamaStreamProducedTokens(hasReceivedData, tokenCount);

  if (!buffer.trim()) return;

  try {
    const data: OllamaResponse = JSON.parse(buffer);
    if (data.response) {
      yield data.response;
    }
  } catch {
    console.warn('Failed to parse final Ollama response:', buffer);
  }
}
