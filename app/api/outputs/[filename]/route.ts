import { NextRequest, NextResponse } from 'next/server';
import { deleteOutputImage, isArchiveFilename } from '@/lib/output-archive';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = decodeURIComponent(params.filename);

    if (!isArchiveFilename(filename)) {
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
