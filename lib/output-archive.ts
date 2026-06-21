import { readdir, stat, unlink, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { resolveUploadDir } from '@/lib/project-paths';
import { processUploadImageBuffer } from '@/lib/image-processing';
import { UPLOAD_IMAGE_EXTENSIONS } from '@/lib/upload-images';
import { ArchiveImageKind, OutputImageEntry, UploadResponse } from '@/types';

export const OUTPUT_DIR = join(process.cwd(), 'comfyui', 'output');
export const UPLOAD_DIR = resolveUploadDir();

const ARCHIVE_FILENAME_RE = /^anthroposcenic_.+\.(png|jpe?g|webp|gif)$/i;
const UPLOAD_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i;
const UPLOAD_IMAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isArchiveFilename(filename: string): boolean {
  return (
    ARCHIVE_FILENAME_RE.test(filename) &&
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\')
  );
}

function isUploadArchiveFilename(filename: string): boolean {
  return (
    UPLOAD_FILENAME_RE.test(filename) &&
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\')
  );
}

function uploadImageIdFromFilename(filename: string): string | null {
  if (!isUploadArchiveFilename(filename)) return null;
  return filename.replace(/\.[^.]+$/, '');
}

function getOutputImageUrl(filename: string, version?: number): string {
  const base = `/api/outputs/image/${encodeURIComponent(filename)}`;
  return version != null ? `${base}?v=${version}` : base;
}

function getUploadImageUrl(imageId: string, version?: number): string {
  const base = `/api/images/${encodeURIComponent(imageId)}`;
  return version != null ? `${base}?v=${version}` : base;
}

/** Skip outputs that are still being written or are clearly incomplete. */
const MIN_ARCHIVE_BYTES = 10 * 1024;
const MIN_AGE_MS = 2_000;

function sortByCreatedAtDesc(entries: OutputImageEntry[]): OutputImageEntry[] {
  return entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function listOutputImages(): Promise<OutputImageEntry[]> {
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
      kind: 'generated',
      filename,
      imageUrl: getOutputImageUrl(filename, fileStat.mtimeMs),
      createdAt: fileStat.mtime.toISOString(),
      size: fileStat.size,
    });
  }

  return sortByCreatedAtDesc(entries);
}

async function listUploadImages(): Promise<OutputImageEntry[]> {
  if (!existsSync(UPLOAD_DIR)) {
    return [];
  }

  const files = await readdir(UPLOAD_DIR);
  const entries: OutputImageEntry[] = [];

  for (const filename of files) {
    if (!isUploadArchiveFilename(filename)) continue;

    const filePath = join(UPLOAD_DIR, filename);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size === 0) continue;

    const imageId = uploadImageIdFromFilename(filename);
    if (!imageId) continue;

    entries.push({
      kind: 'upload',
      filename,
      imageId,
      imageUrl: getUploadImageUrl(imageId, fileStat.mtimeMs),
      createdAt: fileStat.mtime.toISOString(),
      size: fileStat.size,
    });
  }

  return sortByCreatedAtDesc(entries);
}

export async function listArchiveImages(): Promise<OutputImageEntry[]> {
  const [generated, uploads] = await Promise.all([
    listOutputImages(),
    listUploadImages(),
  ]);

  return sortByCreatedAtDesc([...generated, ...uploads]);
}

function getOutputFilePath(filename: string): string {
  return join(OUTPUT_DIR, filename);
}

async function deleteOutputImage(filename: string): Promise<void> {
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

export function isUploadImageId(imageId: string): boolean {
  return UPLOAD_IMAGE_ID_RE.test(imageId);
}

async function deleteUploadImage(imageId: string): Promise<void> {
  if (!isUploadImageId(imageId)) {
    throw new Error('Invalid image id');
  }

  let deleted = false;
  for (const ext of UPLOAD_IMAGE_EXTENSIONS) {
    const filePath = join(UPLOAD_DIR, `${imageId}.${ext}`);
    if (!existsSync(filePath)) continue;
    await unlink(filePath);
    deleted = true;
    console.log(`[Archive] Deleted upload image: ${filePath}`);
    break;
  }

  if (!deleted) {
    throw new Error('Image not found');
  }
}

export async function deleteArchiveImage(
  kind: ArchiveImageKind,
  id: string
): Promise<void> {
  if (kind === 'upload') {
    await deleteUploadImage(id);
    return;
  }
  await deleteOutputImage(id);
}

export async function adoptOutputImage(filename: string): Promise<UploadResponse> {
  if (!isArchiveFilename(filename)) {
    throw new Error('Invalid filename');
  }

  const sourcePath = join(OUTPUT_DIR, filename);
  if (!existsSync(sourcePath)) {
    throw new Error('Image not found');
  }

  const uploadPath = UPLOAD_DIR;
  await mkdir(uploadPath, { recursive: true });

  const inputBuffer = await readFile(sourcePath);
  const imageId = uuidv4();
  const preferPng = filename.toLowerCase().endsWith('.png');
  const { buffer: processedBuffer, mimeType: outputMimeType, extension: outputExtension } =
    await processUploadImageBuffer(inputBuffer, preferPng);

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
