import { NextRequest, NextResponse } from 'next/server';
import { adoptOutputImage, isArchiveFilename } from '@/lib/output-archive';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const filename = typeof body?.filename === 'string' ? body.filename : '';

    if (!isArchiveFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const response = await adoptOutputImage(filename);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to use archive image';
    const status = message === 'Image not found' ? 404 : 500;
    console.error('Adopt output image error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
