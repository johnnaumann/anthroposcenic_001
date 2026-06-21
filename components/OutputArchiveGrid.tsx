'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Layers, Loader2, Sparkles, X } from 'lucide-react';
import { ContentCard, PageLoader } from '@/components/PageShell';
import { OutputArchiveDeleteDialog } from '@/components/OutputArchiveDeleteDialog';
import { OutputArchiveGridItem } from '@/components/OutputArchiveGridItem';
import { OutputArchivePreviewDialog } from '@/components/OutputArchivePreviewDialog';
import { archiveEntryKey } from '@/lib/archive-utils';
import { useOutputArchiveGrid } from '@/lib/use-output-archive-grid';

interface OutputArchiveGridProps {
  onBack?: () => void;
}

export function OutputArchiveGrid({ onBack }: OutputArchiveGridProps) {
  const router = useRouter();
  const {
    images,
    loading,
    busyKey,
    selectMode,
    selected,
    blending,
    pendingDelete,
    previewImage,
    setPendingDelete,
    setPreviewImage,
    setSelected,
    handleUse,
    confirmDelete,
    toggleSelectMode,
    toggleSelect,
    handleBlend,
  } = useOutputArchiveGrid();

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

              return (
                <OutputArchiveGridItem
                  key={key}
                  image={image}
                  selectMode={selectMode}
                  isBusy={busyKey === key}
                  isSelected={selected.includes(key)}
                  onSelect={() => toggleSelect(image)}
                  onUse={() => void handleUse(image)}
                  onPreview={() => setPreviewImage(image)}
                  onDelete={() => setPendingDelete(image)}
                />
              );
            })}
          </div>
        )}
      </div>

      <OutputArchivePreviewDialog image={previewImage} onClose={() => setPreviewImage(null)} />

      <OutputArchiveDeleteDialog
        image={pendingDelete}
        busy={!!busyKey}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </ContentCard>
  );
}
