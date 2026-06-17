import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { UPLOAD_DIR, isUploadImageId } from '@/lib/output-archive';
import { buildOutputImageEtag } from '@/lib/serve-output-image';

const UPLOAD_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: { imageId: string } }
) {
  try {
    const { imageId } = params;

    if (!isUploadImageId(imageId)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    
    let filePath: string | null = null;
    let mimeType: string | null = null;

    for (const ext of UPLOAD_EXTENSIONS) {
      const candidatePath = join(UPLOAD_DIR, `${imageId}.${ext}`);
      if (existsSync(candidatePath)) {
        filePath = candidatePath;
        mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        break;
      }
    }

    if (!filePath || !mimeType) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    const fileStat = await stat(filePath);
    const etag = buildOutputImageEtag(fileStat.size, fileStat.mtimeMs);
    const versioned = request.nextUrl.searchParams.has('v');

    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': versioned
            ? 'private, no-cache, must-revalidate'
            : 'public, max-age=31536000, immutable',
        },
      });
    }

    const fileBuffer = await readFile(filePath);
    const download = request.nextUrl.searchParams.get('download') === '1';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        ETag: etag,
        'Cache-Control': versioned
          ? 'private, no-cache, must-revalidate'
          : 'public, max-age=31536000, immutable',
        ...(download
          ? { 'Content-Disposition': `attachment; filename="${imageId}.${filePath.split('.').pop()}"` }
          : {}),
      },
    });
  } catch (error) {
    console.error('Image retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve image' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { imageId: string } }
) {
  try {
    const { imageId } = params;

    if (!isUploadImageId(imageId)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    
    let deleted = false;
    let deletedPath: string | null = null;

    for (const ext of UPLOAD_EXTENSIONS) {
      const candidatePath = join(UPLOAD_DIR, `${imageId}.${ext}`);
      if (existsSync(candidatePath)) {
        try {
          await unlink(candidatePath);
          deleted = true;
          deletedPath = candidatePath;
          console.log(`Deleted image: ${candidatePath}`);
          break;
        } catch (error) {
          console.error(`Error deleting file ${candidatePath}:`, error);
        }
      }
    }

    if (!deleted) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
      imageId,
      deletedPath,
    });
  } catch (error) {
    console.error('Image deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
