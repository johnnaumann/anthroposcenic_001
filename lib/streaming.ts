/**
 * Utility functions for streaming responses
 */

export interface StreamMessage {
  type: string;
  data?: unknown;
  error?: string;
}

/**
 * Format a message for SSE (Server-Sent Events)
 */
export function formatSSEMessage(message: StreamMessage): string {
  const data = JSON.stringify(message);
  return `data: ${data}\n\n`;
}

/**
 * Create a streaming response with proper headers
 */
export function createStreamResponse(): {
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
