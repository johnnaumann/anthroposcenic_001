import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const COMFYUI_HOST = process.env.COMFYUI_HOST || 'http://localhost:8188';
const OUTPUT_DIR = join(process.cwd(), 'comfyui', 'output');

/**
 * GET /api/comfyui/output?filename=...
 * Proxy route to serve ComfyUI output images through Next.js
 * This ensures images are accessible even if ComfyUI has CORS restrictions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename parameter is required' },
        { status: 400 }
      );
    }

    // Try to read from filesystem first (most reliable)
    const filePath = join(OUTPUT_DIR, filename);
    
    if (existsSync(filePath)) {
      try {
        const fileBuffer = await readFile(filePath);
        const extension = filename.split('.').pop()?.toLowerCase() || 'png';
        const mimeTypes: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
        };
        const mimeType = mimeTypes[extension] || 'image/png';

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
      }
    }

    // Fallback: Proxy from ComfyUI
    try {
      const comfyUrl = `${COMFYUI_HOST}/view?filename=${encodeURIComponent(filename)}&type=output`;
      const response = await fetch(comfyUrl);
      
      if (response.ok) {
        const imageBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';
        
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    } catch (error) {
      console.error(`Error proxying from ComfyUI:`, error);
    }

    return NextResponse.json(
      { error: 'Image not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('ComfyUI output image error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve image' },
      { status: 500 }
    );
  }
}
