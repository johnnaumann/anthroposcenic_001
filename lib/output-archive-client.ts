import { OutputImageEntry, OutputImageListResponse } from '@/types';

export async function fetchArchiveImages(): Promise<OutputImageEntry[]> {
  const response = await fetch('/api/outputs', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load archive');
  }

  const data = (await response.json()) as OutputImageListResponse;
  return data.images;
}

export async function resolveArchiveImageId(image: OutputImageEntry): Promise<string> {
  if (image.kind === 'upload' && image.imageId) {
    return image.imageId;
  }

  const response = await fetch('/api/outputs/use', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'generated', filename: image.filename }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to prepare ${image.filename}`);
  }

  const data = (await response.json()) as { imageId: string };
  return data.imageId;
}

export async function deleteArchiveEntry(image: OutputImageEntry): Promise<void> {
  const query =
    image.kind === 'upload' && image.imageId
      ? `kind=upload&imageId=${encodeURIComponent(image.imageId)}`
      : `kind=generated&filename=${encodeURIComponent(image.filename)}`;

  const response = await fetch(`/api/outputs?${query}`, { method: 'DELETE' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete image');
  }
}
