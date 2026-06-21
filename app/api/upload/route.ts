import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { resolveUploadDir } from '@/lib/project-paths';
import { processUploadImageBuffer } from '@/lib/image-processing';
import { UploadResponse } from '@/types';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB default

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Create upload directory if it doesn't exist
    const uploadPath = resolveUploadDir();
    try {
      await mkdir(uploadPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique filename
    const imageId = uuidv4();
    
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);
    
    // Process image with sharp: resize (preserve aspect ratio) and compress
    let processedBuffer: Buffer;
    let outputMimeType: string;
    let outputExtension: string;
    let originalSize = inputBuffer.length;
    
    try {
      const preferPng = file.type === 'image/png' || file.type === 'image/gif';
      const processed = await processUploadImageBuffer(inputBuffer, preferPng);
      processedBuffer = processed.buffer;
      outputMimeType = processed.mimeType;
      outputExtension = processed.extension;
      
      const filename = `${imageId}.${outputExtension}`;
      const filePath = join(uploadPath, filename);
      
      // Save compressed image
      await writeFile(filePath, processedBuffer);
      
      const compressionRatio = ((1 - processedBuffer.length / originalSize) * 100).toFixed(1);
      console.log(`Image compressed: ${originalSize} bytes → ${processedBuffer.length} bytes (${compressionRatio}% reduction)`);
      
      const response: UploadResponse = {
        imageId,
        imageUrl: `/api/images/${imageId}`,
        filename: file.name,
        size: processedBuffer.length, // Return compressed size
        mimeType: outputMimeType,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Image processing error:', error);
      // Fallback: save original if compression fails
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const filename = `${imageId}.${fileExtension}`;
      const filePath = join(uploadPath, filename);
      await writeFile(filePath, inputBuffer);
      
      const response: UploadResponse = {
        imageId,
        imageUrl: `/api/images/${imageId}`,
        filename: file.name,
        size: originalSize,
        mimeType: file.type,
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
