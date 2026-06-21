/**
 * Utility functions for streaming responses
 */

export interface StreamMessage {
  type: string;
  data?: unknown;
  config?: unknown; // For ComfyUI config in describe route
  error?: string;
}

/**
 * Format a message for SSE (Server-Sent Events)
 */
function formatSSEMessage(message: StreamMessage): string {
  const data = JSON.stringify(message);
  return `data: ${data}\n\n`;
}

/**
 * Create a streaming response with proper headers
 */
function createStreamResponse(): {
  stream: ReadableStream<Uint8Array>;
  controller: ReadableStreamDefaultController<Uint8Array>;
} {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
  });

  return { stream, controller: controller! };
}

function assertFetchStreamResponse(response: Response, errorMessage: string): void {
  if (!response.ok) {
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('No response body');
  }
}

/** Process complete SSE lines from a buffer; return any trailing partial line. */
function drainSSEBuffer(
  buffer: string,
  onLine: (line: string) => boolean | void,
  flush = false
): string {
  const lines = buffer.split('\n');
  const pending = flush ? '' : lines.pop() || '';

  for (const line of lines) {
    if (onLine(line) === true) {
      return flush ? '' : pending;
    }
  }

  return flush ? '' : pending;
}

export async function readFetchSSEStream(
  response: Response,
  options: {
    errorMessage: string;
    onLine: (line: string) => boolean | void;
    shouldStop?: () => boolean;
  }
): Promise<void> {
  assertFetchStreamResponse(response, options.errorMessage);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      drainSSEBuffer(buffer, options.onLine, true);
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = drainSSEBuffer(buffer, options.onLine, false);

    if (options.shouldStop?.()) {
      return;
    }
  }
}

export function parseSSEDataLine(line: string): StreamMessage | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  return JSON.parse(line.slice(6)) as StreamMessage;
}

/**
 * Send a message through the stream
 * Returns false if the controller is closed
 */
export function sendStreamMessage(
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: StreamMessage
): boolean {
  try {
    // Check if controller is still open
    if (controller.desiredSize === null) {
      // Controller is closed
      console.warn('[Streaming] Attempted to send message to closed stream:', message.type);
      return false;
    }
    const formatted = formatSSEMessage(message);
    controller.enqueue(new TextEncoder().encode(formatted));
    return true;
  } catch (error) {
    // Controller might be closed or in an invalid state
    if (error instanceof TypeError && error.message.includes('closed')) {
      console.warn('[Streaming] Attempted to send message to closed stream:', message.type);
      return false;
    }
    throw error;
  }
}

/**
 * Close the stream
 */
export function closeStream(controller: ReadableStreamDefaultController<Uint8Array>): void {
  controller.close();
}

/**
 * Send an error and close the stream
 */
export function sendStreamError(
  controller: ReadableStreamDefaultController<Uint8Array>,
  error: string
): void {
  // Only send error if stream is still open
  if (sendStreamMessage(controller, { type: 'error', error })) {
    closeStream(controller);
  }
}
