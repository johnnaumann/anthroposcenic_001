import { OutputImageEntry } from '@/types';

export function archiveEntryKey(
  entry: Pick<OutputImageEntry, 'kind' | 'filename' | 'imageId'>
): string {
  return entry.kind === 'upload' ? `upload:${entry.imageId}` : `generated:${entry.filename}`;
}
