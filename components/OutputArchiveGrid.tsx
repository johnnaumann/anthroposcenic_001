'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { OutputImageEntry, OutputImageListResponse } from '@/types';
import { cn } from '@/lib/utils';

function formatArchiveDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface OutputArchiveGridProps {
  onBack?: () => void;
}

export function OutputArchiveGrid({ onBack }: OutputArchiveGridProps) {
  const router = useRouter();
  const [images, setImages] = useState<OutputImageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyFilename, setBusyFilename] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/outputs');
      if (!response.ok) {
        throw new Error('Failed to load archive');
      }
      const data: OutputImageListResponse = await response.json();
      setImages(data.images);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load archive');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleUse = async (image: OutputImageEntry) => {
    setBusyFilename(image.filename);
    try {
      const response = await fetch('/api/outputs/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: image.filename }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to use image');
      }

      const data = await response.json();
      toast.success('Image selected');
      router.push(`/describe?imageId=${data.imageId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to use image');
      setBusyFilename(null);
    }
  };

  const handleDelete = async (image: OutputImageEntry) => {
    if (!window.confirm(`Remove ${image.filename} from the archive?`)) {
      return;
    }

    setBusyFilename(image.filename);
    try {
      const response = await fetch(
        `/api/outputs?filename=${encodeURIComponent(image.filename)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete image');
      }

      setImages((current) => current.filter((entry) => entry.filename !== image.filename));
      toast.success('Removed from archive');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      setBusyFilename(null);
    }
  };

  const downloadUrl = (image: OutputImageEntry) =>
    `${image.imageUrl}${image.imageUrl.includes('?') ? '&' : '?'}download=1`;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading archive…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-base font-medium">Archive</h1>
          <p className="text-sm text-muted-foreground">
            Previously rendered images. Select one to reinterpret, or download and manage the archive.
          </p>
        </div>
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft />
            Back
          </Button>
        )}
      </div>

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">No rendered images yet.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/upload')}>
            Upload an image
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image) => {
            const isBusy = busyFilename === image.filename;

            return (
              <article
                key={image.filename}
                className={cn(
                  'group overflow-hidden rounded-xl border border-border bg-card transition-colors',
                  isBusy && 'opacity-60'
                )}
              >
                <div className="relative aspect-square overflow-hidden bg-muted/30">
                  <img
                    src={image.imageUrl}
                    alt={image.filename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="space-y-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{image.filename}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatArchiveDate(image.createdAt)} · {formatFileSize(image.size)}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon-sm"
                      aria-label="Use image"
                      title="Use"
                      disabled={isBusy}
                      onClick={() => handleUse(image)}
                    >
                      {isBusy ? <Loader2 className="animate-spin" /> : <Wand2 />}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label="Download image"
                      title="Download"
                      disabled={isBusy}
                      asChild
                    >
                      <a href={downloadUrl(image)} download={image.filename}>
                        <Download />
                      </a>
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label="Delete from archive"
                      title="Delete"
                      disabled={isBusy}
                      onClick={() => handleDelete(image)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
