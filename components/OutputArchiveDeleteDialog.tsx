'use client';

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
import { Loader2 } from 'lucide-react';
import { OutputImageEntry } from '@/types';

interface OutputArchiveDeleteDialogProps {
  image: OutputImageEntry | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function OutputArchiveDeleteDialog({
  image,
  busy,
  onCancel,
  onConfirm,
}: OutputArchiveDeleteDialogProps) {
  return (
    <AlertDialog
      open={!!image}
      onOpenChange={(open) => {
        if (!open && !busy) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from archive?</AlertDialogTitle>
          <AlertDialogDescription>
            {image?.kind === 'upload'
              ? 'This original upload will be permanently deleted.'
              : 'This generated image will be permanently deleted.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="-mx-0 -mb-0 border-0 bg-transparent p-0 sm:justify-end">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? <Loader2 className="animate-spin" /> : 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
