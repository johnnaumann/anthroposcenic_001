import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function GET(
  request: NextRequest,
  { params }: { params: { imageId: string } }
) {
  try {
    const { imageId } = params;
    
    // Find the file with this imageId (could be any extension)
    const uploadPath = join(process.cwd(), UPLOAD_DIR);
    const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    let filePath: string | null = null;
    let mimeType: string | null = null;

    for (const ext of extensions) {
      const candidatePath = join(uploadPath, `${imageId}.${ext}`);
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

    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
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
    
    // Find and delete the file with this imageId (could be any extension)
    const uploadPath = join(process.cwd(), UPLOAD_DIR);
    const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    let deleted = false;
    let deletedPath: string | null = null;

    for (const ext of extensions) {
      const candidatePath = join(uploadPath, `${imageId}.${ext}`);
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
