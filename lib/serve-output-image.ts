import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { OUTPUT_DIR } from '@/lib/output-archive';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function isSafeOutputFilename(filename: string): boolean {
  return (
    Boolean(filename) &&
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\')
  );
}

function outputMimeType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || 'png';
  return MIME_TYPES[extension] || 'image/png';
}

export function buildOutputImageEtag(size: number, mtimeMs: number): string {
  return `"${size}-${mtimeMs}"`;
}

export async function serveOutputImageFile(
  filename: string,
  options?: { request?: NextRequest; download?: boolean }
): Promise<NextResponse> {
  if (!isSafeOutputFilename(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = join(OUTPUT_DIR, filename);

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  if (!fileStat.isFile() || fileStat.size === 0) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  const etag = buildOutputImageEtag(fileStat.size, fileStat.mtimeMs);

  if (options?.request?.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'private, no-cache, must-revalidate',
      },
    });
  }

  const fileBuffer = await readFile(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': outputMimeType(filename),
      'Cache-Control': 'private, no-cache, must-revalidate',
      ETag: etag,
      ...(options?.download
        ? { 'Content-Disposition': `attachment; filename="${filename}"` }
        : {}),
    },
  });
}
