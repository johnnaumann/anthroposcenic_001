import { NextRequest } from 'next/server';
import { DESCRIBE_SSE_HEADERS, runDescribeStream } from '@/lib/describe-route';

export async function POST(request: NextRequest) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      console.log('[Describe] Stream cancelled by client');
    },
  });

  void runDescribeStream(request, controller);

  return new Response(stream, {
    headers: DESCRIBE_SSE_HEADERS,
  });
}
