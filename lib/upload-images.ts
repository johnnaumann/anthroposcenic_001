import { join } from 'path';
import { existsSync } from 'fs';
import { resolveUploadDir } from '@/lib/project-paths';

export const UPLOAD_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export async function findUploadImageFile(
  imageId: string
): Promise<{ path: string; mimeType: string } | null> {
  const uploadPath = resolveUploadDir();

  for (const ext of UPLOAD_IMAGE_EXTENSIONS) {
    const candidatePath = join(uploadPath, `${imageId}.${ext}`);
    if (existsSync(candidatePath)) {
      return {
        path: candidatePath,
        mimeType: MIME_TYPES[ext] || `image/${ext}`,
      };
    }
  }

  return null;
}
