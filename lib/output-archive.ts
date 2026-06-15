import { readdir, stat, unlink, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { OutputImageEntry, UploadResponse } from '@/types';

export const OUTPUT_DIR = join(process.cwd(), 'comfyui', 'output');
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const MAX_IMAGE_WIDTH = parseInt(process.env.MAX_IMAGE_WIDTH || '1024', 10);
const MAX_IMAGE_HEIGHT = parseInt(process.env.MAX_IMAGE_HEIGHT || '1024', 10);
const JPEG_QUALITY = parseInt(process.env.JPEG_QUALITY || '95', 10);
const PNG_QUALITY = parseInt(process.env.PNG_QUALITY || '95', 10);

const ARCHIVE_FILENAME_RE = /^anthroposcenic_.+\.(png|jpe?g|webp|gif)$/i;

export function isArchiveFilename(filename: string): boolean {
  return (
    ARCHIVE_FILENAME_RE.test(filename) &&
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\')
  );
}

export function getOutputImageUrl(filename: string, version?: number): string {
  const base = `/api/outputs/image/${encodeURIComponent(filename)}`;
  return version != null ? `${base}?v=${version}` : base;
}

/** Skip outputs that are still being written or are clearly incomplete. */
const MIN_ARCHIVE_BYTES = 10 * 1024;
const MIN_AGE_MS = 2_000;

export async function listOutputImages(): Promise<OutputImageEntry[]> {
  if (!existsSync(OUTPUT_DIR)) {
    return [];
  }

  const files = await readdir(OUTPUT_DIR);
  const entries: OutputImageEntry[] = [];
  const now = Date.now();

  for (const filename of files) {
    if (!isArchiveFilename(filename)) continue;

    const filePath = join(OUTPUT_DIR, filename);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) continue;
    if (fileStat.size < MIN_ARCHIVE_BYTES) continue;
    if (now - fileStat.mtimeMs < MIN_AGE_MS) continue;

    entries.push({
      filename,
      imageUrl: getOutputImageUrl(filename, fileStat.mtimeMs),
      createdAt: fileStat.mtime.toISOString(),
      size: fileStat.size,
    });
  }

  return entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getOutputFilePath(filename: string): string {
  return join(OUTPUT_DIR, filename);
}

export async function deleteOutputImage(filename: string): Promise<void> {
  if (!isArchiveFilename(filename)) {
    throw new Error('Invalid filename');
  }

  const filePath = getOutputFilePath(filename);
  if (!existsSync(filePath)) {
    throw new Error('Image not found');
  }

  await unlink(filePath);

  if (existsSync(filePath)) {
    throw new Error('Failed to delete image from output folder');
  }

  console.log(`[Archive] Deleted output image: ${filePath}`);
}

export async function adoptOutputImage(filename: string): Promise<UploadResponse> {
  if (!isArchiveFilename(filename)) {
    throw new Error('Invalid filename');
  }

  const sourcePath = join(OUTPUT_DIR, filename);
  if (!existsSync(sourcePath)) {
    throw new Error('Image not found');
  }

  const uploadPath = join(process.cwd(), UPLOAD_DIR);
  await mkdir(uploadPath, { recursive: true });

  const inputBuffer = await readFile(sourcePath);
  const imageId = uuidv4();
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const hasTransparency = metadata.hasAlpha && filename.toLowerCase().endsWith('.png');

  let processedBuffer: Buffer;
  let outputMimeType: string;
  let outputExtension: string;

  if (hasTransparency) {
    outputMimeType = 'image/png';
    outputExtension = 'png';
    processedBuffer = await image
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ quality: PNG_QUALITY, compressionLevel: 9 })
      .toBuffer();
  } else {
    outputMimeType = 'image/jpeg';
    outputExtension = 'jpg';
    processedBuffer = await image
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  }

  const destPath = join(uploadPath, `${imageId}.${outputExtension}`);
  await writeFile(destPath, processedBuffer);

  return {
    imageId,
    imageUrl: `/api/images/${imageId}`,
    filename,
    size: processedBuffer.length,
    mimeType: outputMimeType,
  };
}
