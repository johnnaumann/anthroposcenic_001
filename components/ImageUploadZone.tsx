'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadResponse } from '@/types';
import { Upload, X } from 'lucide-react';

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
      // Restart Ollama and ComfyUI services for clean state
      setError('Restarting services for clean state...');
      try {
        const restartResponse = await fetch('/api/services/restart', {
          method: 'POST',
        });
        
        if (!restartResponse.ok) {
          const restartError = await restartResponse.json();
          console.warn('[Upload] Service restart warning:', restartError);
          // Continue anyway - services might already be running or restarting
        } else {
          const restartData = await restartResponse.json();
          console.log('[Upload] Services restarted:', restartData);
        }
      } catch (restartError) {
        console.warn('[Upload] Service restart failed, continuing anyway:', restartError);
        // Continue with upload even if restart fails - services might be running
      }

      // Small delay to ensure services are ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Upload the image
      setError('Uploading image...');
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

      // Clear local state
      setPreview(null);
      setCurrentImageId(null);
      setError(null);

      // Notify parent component
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
    <Card>
      <CardHeader>
        <CardTitle>Upload Image</CardTitle>
        <CardDescription>
          Drag and drop an image or click to browse
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
          `}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            disabled={disabled || isUploading}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className="cursor-pointer"
          >
            {preview ? (
              <div className="space-y-4 relative">
                <div className="relative inline-block mx-auto">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg"
                  />
                  {!disabled && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove();
                      }}
                      disabled={isRemoving}
                      className="absolute top-2 right-2 p-1.5 bg-background/90 hover:bg-background border border-foreground/30 rounded-md transition-colors disabled:opacity-50 shadow-sm"
                      title="Remove image"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Image uploaded successfully
                  </p>
                  {!disabled && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove();
                      }}
                      disabled={isRemoving}
                      className="text-sm text-muted-foreground hover:text-foreground underline disabled:opacity-50"
                    >
                      {isRemoving ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, GIF, WEBP up to 10MB
                  </p>
                </div>
              </div>
            )}
          </label>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-muted text-foreground/80 border border-foreground/20 text-sm rounded-md">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
