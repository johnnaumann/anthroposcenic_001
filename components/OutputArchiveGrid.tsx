'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Download, Layers, Loader2, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ContentCard, PageLoader } from '@/components/PageShell';
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

// How many archive images can be fused into one prompt at once.
const MAX_BLEND = 5;

/** Thumbnail that fades in once it has loaded — including images already in cache. */
function ArchiveImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reveal = () => setLoaded(true);

  useEffect(() => {
    // A cached image can finish before React attaches onLoad; reveal it anyway.
    if (ref.current?.complete && ref.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <Image
      ref={ref}
      src={src}
      alt={alt}
      width={1024}
      height={1024}
      unoptimized
      sizes="(max-width: 640px) 50vw, 33vw"
      onLoad={reveal}
      onError={reveal}
      className={cn(
        'h-auto w-full transition-opacity duration-700 ease-out',
        loaded ? 'opacity-100' : 'opacity-0'
      )}
    />
  );
}

export function OutputArchiveGrid({ onBack }: OutputArchiveGridProps) {
  const router = useRouter();
  const [images, setImages] = useState<OutputImageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyFilename, setBusyFilename] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [blending, setBlending] = useState(false);

  const loadImages = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const response = await fetch('/api/outputs', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load archive');
      }
      const data: OutputImageListResponse = await response.json();
      setImages(data.images);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load archive');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const didInitialLoad = useRef(false);
  useEffect(() => {
    // Fetch once. React Strict Mode (on in dev) double-invokes effects, which
    // would toggle `loading` — and the page's card — twice, flickering a card
    // behind the spinner. The guard keeps the load→loaded transition to one step.
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    void loadImages();
  }, [loadImages]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        void loadImages({ silent: true });
      }
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
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

  const toggleSelectMode = () => {
    setSelectMode((on) => !on);
    setSelected([]);
  };

  const toggleSelect = (filename: string) => {
    setSelected((current) => {
      if (current.includes(filename)) {
        return current.filter((f) => f !== filename);
      }
      if (current.length >= MAX_BLEND) {
        toast.error(`You can blend up to ${MAX_BLEND} images at once.`);
        return current;
      }
      return [...current, filename];
    });
  };

  const handleBlend = async () => {
    if (selected.length < 2) return;
    setBlending(true);
    try {
      // Adopt every selected archive image into the upload store; the describe
      // step then fuses them into one prompt and generates a fresh image.
      const ids = await Promise.all(
        selected.map(async (filename) => {
          const res = await fetch('/api/outputs/use', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `Failed to prepare ${filename}`);
          }
          const { imageId } = await res.json();
          return imageId as string;
        })
      );
      router.push(`/describe?imageIds=${ids.join(',')}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare the blend');
      setBlending(false);
    }
  };

  const downloadUrl = (image: OutputImageEntry) =>
    `${image.imageUrl}${image.imageUrl.includes('?') ? '&' : '?'}download=1`;

  if (loading) {
    return <PageLoader label="Loading archive…" />;
  }

  return (
    <ContentCard>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-base font-medium">Archive</h1>
            <p className="text-sm text-muted-foreground">
              {selectMode
                ? 'Pick 2 or more images to blend into one abstract piece.'
                : 'Previously rendered images. Reinterpret one, blend several, or manage the archive.'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {images.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleSelectMode} disabled={blending}>
                {selectMode ? <X /> : <Layers />}
                {selectMode ? 'Cancel' : 'Blend'}
              </Button>
            )}
            {onBack && !selectMode && (
              <Button variant="outline" size="sm" onClick={onBack}>
                <ArrowLeft />
                Back
              </Button>
            )}
          </div>
        </div>

        {selectMode && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-accent/30 px-3 py-2">
            <span className="text-sm text-muted-foreground">
              {selected.length === 0
                ? 'No images selected'
                : `${selected.length} selected${selected.length < 2 ? ' · pick at least 2' : ''}`}
            </span>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected([])}
                disabled={selected.length === 0 || blending}
              >
                Clear
              </Button>
              <Button size="sm" onClick={handleBlend} disabled={selected.length < 2 || blending}>
                {blending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Blend{selected.length ? ` ${selected.length}` : ''}
              </Button>
            </div>
          </div>
        )}

        {images.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">No rendered images yet.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/upload')}>
              Upload an image
            </Button>
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3">
            {images.map((image) => {
              const isBusy = busyFilename === image.filename;
              const isSelected = selected.includes(image.filename);

              return (
                <article
                  key={image.filename}
                  onClick={selectMode ? () => toggleSelect(image.filename) : undefined}
                  className={cn(
                    'relative mb-3 break-inside-avoid overflow-hidden rounded-xl border bg-card transition',
                    isBusy && 'opacity-60',
                    selectMode && 'cursor-pointer',
                    isSelected ? 'border-foreground ring-2 ring-foreground' : 'border-border'
                  )}
                >
                  {selectMode && (
                    <span
                      className={cn(
                        'absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
                        isSelected
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-white/70 bg-black/40 text-transparent'
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}

                  <div className="bg-muted/30">
                    <ArchiveImage key={image.imageUrl} src={image.imageUrl} alt={image.filename} />
                  </div>

                  <div className="space-y-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{image.filename}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatArchiveDate(image.createdAt)} · {formatFileSize(image.size)}
                      </p>
                    </div>

                    {!selectMode && (
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
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ContentCard>
  );
}
