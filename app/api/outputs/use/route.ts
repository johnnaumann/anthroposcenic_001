import { NextRequest, NextResponse } from 'next/server';
import { adoptOutputImage, isArchiveFilename, isUploadImageId } from '@/lib/output-archive';
import { ArchiveImageKind } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const kind = (body?.kind ?? 'generated') as ArchiveImageKind;

    if (kind === 'upload') {
      const imageId = typeof body?.imageId === 'string' ? body.imageId : '';
      if (!isUploadImageId(imageId)) {
        return NextResponse.json({ error: 'Invalid image id' }, { status: 400 });
      }
      return NextResponse.json({
        imageId,
        imageUrl: `/api/images/${imageId}`,
      });
    }

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
