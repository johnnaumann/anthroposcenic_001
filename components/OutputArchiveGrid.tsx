'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Check, Download, Expand, Layers, Loader2, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ContentCard, PageLoader } from '@/components/PageShell';
import { archiveEntryKey } from '@/lib/archive-utils';
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

function KindChip({ kind }: { kind: OutputImageEntry['kind'] }) {
  return (
    <span className="absolute left-2 top-2 z-10 rounded-full border border-border bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
      {kind === 'upload' ? 'Original' : 'Generated'}
    </span>
  );
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
      fill
      unoptimized
      sizes="(max-width: 640px) 50vw, 33vw"
      onLoad={reveal}
      onError={reveal}
      className={cn(
        'object-cover transition-opacity duration-700 ease-out',
        loaded ? 'opacity-100' : 'opacity-0'
      )}
    />
  );
}

export function OutputArchiveGrid({ onBack }: OutputArchiveGridProps) {
  const router = useRouter();
  const [images, setImages] = useState<OutputImageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [blending, setBlending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<OutputImageEntry | null>(null);
  const [previewImage, setPreviewImage] = useState<OutputImageEntry | null>(null);

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
    const key = archiveEntryKey(image);
    setBusyKey(key);
    try {
      if (image.kind === 'upload' && image.imageId) {
        toast.success('Image selected');
        router.push(`/describe?imageId=${image.imageId}`);
        return;
      }

      const response = await fetch('/api/outputs/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'generated', filename: image.filename }),
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
      setBusyKey(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    const image = pendingDelete;
    const key = archiveEntryKey(image);
    setBusyKey(key);
    try {
      const query =
        image.kind === 'upload' && image.imageId
          ? `kind=upload&imageId=${encodeURIComponent(image.imageId)}`
          : `kind=generated&filename=${encodeURIComponent(image.filename)}`;

      const response = await fetch(`/api/outputs?${query}`, { method: 'DELETE' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete image');
      }

      setImages((current) => current.filter((entry) => archiveEntryKey(entry) !== key));
      toast.success('Removed from archive');
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      setBusyKey(null);
    }
  };

  const toggleSelectMode = () => {
    setSelectMode((on) => !on);
    setSelected([]);
  };

  const toggleSelect = (image: OutputImageEntry) => {
    const key = archiveEntryKey(image);
    setSelected((current) => {
      if (current.includes(key)) {
        return current.filter((entryKey) => entryKey !== key);
      }
      if (current.length >= MAX_BLEND) {
        toast.error(`You can blend up to ${MAX_BLEND} images at once.`);
        return current;
      }
      return [...current, key];
    });
  };

  const handleBlend = async () => {
    if (selected.length < 2) return;
    setBlending(true);
    try {
      const ids = await Promise.all(
        selected.map(async (key) => {
          const image = images.find((entry) => archiveEntryKey(entry) === key);
          if (!image) {
            throw new Error('Image not found');
          }

          if (image.kind === 'upload' && image.imageId) {
            return image.imageId;
          }

          const res = await fetch('/api/outputs/use', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'generated', filename: image.filename }),
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `Failed to prepare ${image.filename}`);
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

  const downloadUrl = (image: OutputImageEntry) => {
    const base = image.imageUrl;
    const joiner = base.includes('?') ? '&' : '?';
    return `${base}${joiner}download=1`;
  };

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
                : 'Original uploads and generated renders. Reinterpret, blend, or manage the archive.'}
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
            <p className="text-sm text-muted-foreground">No images yet.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/upload')}>
              Upload an image
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image) => {
              const key = archiveEntryKey(image);
              const isBusy = busyKey === key;
              const isSelected = selected.includes(key);

              return (
                <article
                  key={key}
                  onClick={selectMode ? () => toggleSelect(image) : undefined}
                  className={cn(
                    'relative overflow-hidden rounded-xl border bg-card transition',
                    isBusy && 'opacity-60',
                    selectMode && 'cursor-pointer',
                    isSelected ? 'border-foreground ring-2 ring-foreground' : 'border-border'
                  )}
                >
                  {selectMode && (
                    <span
                      className={cn(
                        'absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
                        isSelected
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-white/70 bg-black/40 text-transparent'
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}

                  <KindChip kind={image.kind} />

                  <div className="relative aspect-[9/16] w-full bg-muted/30">
                    <ArchiveImage
                      key={image.imageUrl}
                      src={image.imageUrl}
                      alt={image.kind === 'upload' ? 'Original upload' : 'Generated image'}
                    />
                  </div>

                  <div className="space-y-3 p-3">
                    <p className="text-[11px] text-muted-foreground">
                      {formatArchiveDate(image.createdAt)} · {formatFileSize(image.size)}
                    </p>

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
                          aria-label="View fullscreen"
                          title="View"
                          disabled={isBusy}
                          onClick={() => setPreviewImage(image)}
                        >
                          <Expand />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label="Delete from archive"
                          title="Delete"
                          disabled={isBusy}
                          onClick={() => setPendingDelete(image)}
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

      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent
          className="w-auto max-w-[min(100vw-2rem,36rem)] gap-3 p-3 sm:max-w-[min(100vw-2rem,36rem)]"
          showCloseButton
        >
          <DialogTitle className="sr-only">
            {previewImage?.kind === 'upload' ? 'Original upload' : 'Generated image'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Fullscreen archive image preview
          </DialogDescription>

          {previewImage && (
            <div className="space-y-3">
              <div className="relative mx-auto aspect-[9/16] w-[min(100vw-4rem,calc(85dvh*9/16))] max-h-[85dvh] overflow-hidden rounded-lg bg-muted/30">
                <Image
                  src={previewImage.imageUrl}
                  alt={previewImage.kind === 'upload' ? 'Original upload' : 'Generated image'}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 36rem"
                  className="object-contain"
                  priority
                />
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                {previewImage.kind === 'upload' ? 'Original' : 'Generated'} ·{' '}
                {formatArchiveDate(previewImage.createdAt)} · {formatFileSize(previewImage.size)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !busyKey) {
            setPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from archive?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === 'upload'
                ? 'This original upload will be permanently deleted.'
                : 'This generated image will be permanently deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0 sm:justify-end">
            <AlertDialogCancel disabled={!!busyKey}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!!busyKey}
              onClick={() => void confirmDelete()}
            >
              {busyKey ? <Loader2 className="animate-spin" /> : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContentCard>
  );
}
