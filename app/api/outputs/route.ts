import { NextRequest, NextResponse } from 'next/server';
import { deleteOutputImage, isArchiveFilename, listOutputImages } from '@/lib/output-archive';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const images = await listOutputImages();
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
    const filename = request.nextUrl.searchParams.get('filename');

    if (!filename || !isArchiveFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    await deleteOutputImage(filename);

    return NextResponse.json({
      success: true,
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete image';
    const status = message === 'Image not found' ? 404 : 500;
    console.error('Output image deletion error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
