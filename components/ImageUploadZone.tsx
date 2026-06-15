'use client';

import { useState, useCallback, useEffect } from 'react';
import { UploadResponse } from '@/types';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageUploadZoneProps {
  onUploadComplete: (response: UploadResponse) => void;
  onRemove?: () => void;
  imageId?: string | null;
  disabled?: boolean;
}

export function ImageUploadZone({ onUploadComplete, onRemove, imageId, disabled }: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentImageId, setCurrentImageId] = useState<string | null>(imageId || null);

  // Sync with imageId prop changes (e.g., when parent resets)
  useEffect(() => {
    if (imageId) {
      setCurrentImageId(imageId);
      setPreview(`/api/images/${imageId}`);
    } else {
      setCurrentImageId(null);
      setPreview(null);
    }
  }, [imageId]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data: UploadResponse = await response.json();
      setPreview(data.imageUrl);
      setCurrentImageId(data.imageId);
      setError(null);
      onUploadComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [disabled, handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleRemove = useCallback(async () => {
    if (!currentImageId) return;

    setIsRemoving(true);
    setError(null);

    try {
      const response = await fetch(`/api/images/${currentImageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove image');
      }

      setPreview(null);
      setCurrentImageId(null);
      setError(null);

      if (onRemove) {
        onRemove();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove image');
    } finally {
      setIsRemoving(false);
    }
  }, [currentImageId, onRemove]);

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'rounded-xl border border-dashed transition-colors',
          isDragging ? 'border-foreground/50 bg-accent/40' : 'border-border',
          disabled && 'opacity-50'
        )}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          disabled={disabled || isUploading}
          className="hidden"
          id="image-upload"
        />

        {preview ? (
          <div className="p-4">
            <div className="relative mx-auto w-fit">
              <img src={preview} alt="Preview" className="max-h-72 rounded-lg" />
              {!disabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="absolute right-2 top-2 bg-background/80 backdrop-blur"
                  title="Remove image"
                  aria-label="Remove image"
                >
                  <X />
                </Button>
              )}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Image ready</span>
              {!disabled && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="h-auto p-0 text-muted-foreground"
                >
                  {isRemoving ? 'Removing…' : 'Remove'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <label
            htmlFor="image-upload"
            className={cn(
              'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center',
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted-foreground">
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-medium">
                {isUploading ? 'Uploading…' : 'Click to upload or drag & drop'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, GIF, WEBP · up to 10MB</p>
            </div>
          </label>
        )}
      </div>

      {error && <p className="text-sm text-muted-foreground">{error}</p>}
    </div>
  );
}
