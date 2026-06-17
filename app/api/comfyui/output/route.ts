import { NextRequest, NextResponse } from 'next/server';
import { isSafeOutputFilename, serveOutputImageFile } from '@/lib/serve-output-image';

const COMFYUI_HOST = process.env.COMFYUI_HOST || 'http://localhost:8188';

/**
 * GET /api/comfyui/output?filename=...
 * Proxy route to serve ComfyUI output images through Next.js
 * This ensures images are accessible even if ComfyUI has CORS restrictions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');
    const download = searchParams.get('download') === '1';

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename parameter is required' },
        { status: 400 }
      );
    }

    if (!isSafeOutputFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const localResponse = await serveOutputImageFile(filename, { request, download });
    if (localResponse.status !== 404) {
      return localResponse;
    }

    // Fallback: proxy from ComfyUI when the file is not on disk yet
    try {
      const comfyUrl = `${COMFYUI_HOST}/view?filename=${encodeURIComponent(filename)}&type=output`;
      const response = await fetch(comfyUrl, { cache: 'no-store' });

      if (response.ok) {
        const imageBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';

        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, no-cache, must-revalidate',
            ...(download
              ? { 'Content-Disposition': `attachment; filename="${filename}"` }
              : {}),
          },
        });
      }
    } catch (error) {
      console.error('Error proxying from ComfyUI:', error);
    }

    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  } catch (error) {
    console.error('ComfyUI output image error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve image' },
      { status: 500 }
    );
  }
}
