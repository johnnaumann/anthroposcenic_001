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
 */
export function sendStreamMessage(
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: StreamMessage
): void {
  const formatted = formatSSEMessage(message);
  controller.enqueue(new TextEncoder().encode(formatted));
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
  sendStreamMessage(controller, { type: 'error', error });
  closeStream(controller);
}
