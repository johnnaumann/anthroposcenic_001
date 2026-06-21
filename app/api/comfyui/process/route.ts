import { NextRequest } from 'next/server';
import { COMFYUI_PROCESS_SSE_HEADERS, runComfyUIProcessStream } from '@/lib/comfyui-process-route';

export async function POST(request: NextRequest) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
  });

  void runComfyUIProcessStream(request, controller);

  return new Response(stream, {
    headers: COMFYUI_PROCESS_SSE_HEADERS,
  });
}
