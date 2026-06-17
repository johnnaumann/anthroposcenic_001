import { NextRequest, NextResponse } from 'next/server';
import { deleteArchiveImage, isArchiveFilename, isUploadImageId, listArchiveImages } from '@/lib/output-archive';
import { ArchiveImageKind } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const images = await listArchiveImages();
    return NextResponse.json(
      { images },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Failed to list output images:', error);
    return NextResponse.json(
      { error: 'Failed to list archive images' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get('kind') as ArchiveImageKind | null;
    const filename = request.nextUrl.searchParams.get('filename');
    const imageId = request.nextUrl.searchParams.get('imageId');

    if (kind === 'upload') {
      if (!imageId || !isUploadImageId(imageId)) {
        return NextResponse.json({ error: 'Invalid image id' }, { status: 400 });
      }
      await deleteArchiveImage('upload', imageId);
      return NextResponse.json({ success: true, kind, imageId });
    }

    if (!filename || !isArchiveFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    await deleteArchiveImage('generated', filename);

    return NextResponse.json({
      success: true,
      kind: 'generated',
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete image';
    const status = message === 'Image not found' ? 404 : 500;
    console.error('Output image deletion error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
