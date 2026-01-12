import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
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
