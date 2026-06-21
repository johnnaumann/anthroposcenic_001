'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatArchiveDate, formatFileSize } from '@/lib/archive-display';
import { OutputImageEntry } from '@/types';

interface OutputArchivePreviewDialogProps {
  image: OutputImageEntry | null;
  onClose: () => void;
}

export function OutputArchivePreviewDialog({ image, onClose }: OutputArchivePreviewDialogProps) {
  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-auto max-w-[min(100vw-2rem,36rem)] gap-3 p-3 sm:max-w-[min(100vw-2rem,36rem)]"
        showCloseButton
      >
        <DialogTitle className="sr-only">
          {image?.kind === 'upload' ? 'Original upload' : 'Generated image'}
        </DialogTitle>
        <DialogDescription className="sr-only">Fullscreen archive image preview</DialogDescription>

        {image && (
          <div className="space-y-3">
            <div className="relative mx-auto aspect-[9/16] w-[min(100vw-4rem,calc(85dvh*9/16))] max-h-[85dvh] overflow-hidden rounded-lg bg-muted/30">
              <Image
                src={image.imageUrl}
                alt={image.kind === 'upload' ? 'Original upload' : 'Generated image'}
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, 36rem"
                className="object-contain"
                priority
              />
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              {image.kind === 'upload' ? 'Original' : 'Generated'} ·{' '}
              {formatArchiveDate(image.createdAt)} · {formatFileSize(image.size)}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
