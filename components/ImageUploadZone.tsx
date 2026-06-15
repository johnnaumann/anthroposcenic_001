'use client';

import { useState, useCallback, useRef } from 'react';
import { UploadResponse } from '@/types';
import { Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ImageUploadZoneProps {
  onUploadComplete: (response: UploadResponse) => void;
  disabled?: boolean;
}

export function ImageUploadZone({ onUploadComplete, disabled }: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      resetFileInput();
      return;
    }

    setIsUploading(true);

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
      toast.success('Image uploaded');
      onUploadComplete(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
      resetFileInput();
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [disabled, isUploading, handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'rounded-xl border border-dashed transition-colors',
        isDragging ? 'border-foreground/50 bg-accent/40' : 'border-border',
        (disabled || isUploading) && 'opacity-50'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        disabled={disabled || isUploading}
        className="hidden"
        id="image-upload"
      />

      <label
        htmlFor="image-upload"
        className={cn(
          'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center',
          disabled || isUploading ? 'cursor-not-allowed' : 'cursor-pointer'
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
    </div>
  );
}
