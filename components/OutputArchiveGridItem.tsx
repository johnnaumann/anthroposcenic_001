'use client';

import { Button } from '@/components/ui/button';
import { Check, Download, Expand, Loader2, Trash2, Wand2 } from 'lucide-react';
import { archiveDownloadUrl, formatArchiveDate, formatFileSize } from '@/lib/archive-display';
import { OutputImageEntry } from '@/types';
import { cn } from '@/lib/utils';
import { OutputArchiveImage } from '@/components/OutputArchiveImage';

function KindChip({ kind }: { kind: OutputImageEntry['kind'] }) {
  return (
    <span className="absolute left-2 top-2 z-10 rounded-full border border-border bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
      {kind === 'upload' ? 'Original' : 'Generated'}
    </span>
  );
}

interface OutputArchiveGridItemProps {
  image: OutputImageEntry;
  selectMode: boolean;
  isBusy: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onUse: () => void;
  onPreview: () => void;
  onDelete: () => void;
}

export function OutputArchiveGridItem({
  image,
  selectMode,
  isBusy,
  isSelected,
  onSelect,
  onUse,
  onPreview,
  onDelete,
}: OutputArchiveGridItemProps) {
  const alt = image.kind === 'upload' ? 'Original upload' : 'Generated image';

  return (
    <article
      onClick={selectMode ? onSelect : undefined}
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
        <OutputArchiveImage key={image.imageUrl} src={image.imageUrl} alt={alt} />
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
              onClick={onUse}
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
              <a href={archiveDownloadUrl(image.imageUrl)} download={image.filename}>
                <Download />
              </a>
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="View fullscreen"
              title="View"
              disabled={isBusy}
              onClick={onPreview}
            >
              <Expand />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Delete from archive"
              title="Delete"
              disabled={isBusy}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
