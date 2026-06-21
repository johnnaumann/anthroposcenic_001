'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { archiveEntryKey } from '@/lib/archive-utils';
import {
  deleteArchiveEntry,
  fetchArchiveImages,
  resolveArchiveImageId,
} from '@/lib/output-archive-client';
import { OutputImageEntry } from '@/types';

const MAX_BLEND = 5;

export function useOutputArchiveGrid() {
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
      setImages(await fetchArchiveImages());
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
    if (didInitialLoad.current) {
      return;
    }

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
      const imageId = await resolveArchiveImageId(image);
      toast.success('Image selected');
      router.push(`/describe?imageId=${imageId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to use image');
      setBusyKey(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    const image = pendingDelete;
    const key = archiveEntryKey(image);
    setBusyKey(key);

    try {
      await deleteArchiveEntry(image);
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
    if (selected.length < 2) {
      return;
    }

    setBlending(true);

    try {
      const ids = await Promise.all(
        selected.map(async (key) => {
          const image = images.find((entry) => archiveEntryKey(entry) === key);
          if (!image) {
            throw new Error('Image not found');
          }

          return resolveArchiveImageId(image);
        })
      );

      router.push(`/describe?imageIds=${ids.join(',')}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare the blend');
      setBlending(false);
    }
  };

  return {
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
    loadImages,
    handleUse,
    confirmDelete,
    toggleSelectMode,
    toggleSelect,
    handleBlend,
  };
}
