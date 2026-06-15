'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { ComfyUIConfig } from '@/types';

interface ComfyUIProgressProps {
  imageId: string | null;
  config: ComfyUIConfig | null;
  onProcessingComplete: (imageUrl: string) => void;
  disabled?: boolean;
}

export function ComfyUIProgress({ imageId, config, onProcessingComplete, disabled }: ComfyUIProgressProps) {
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useImage, setUseImage] = useState<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (imageId) {
      setUseImage(true);
    }
  }, [imageId]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [imageId, config, disabled]);

  const startProcessing = async () => {
    if (!config) return;

    if (useImage && !imageId) {
      toast.error('Image is required for image-to-image mode');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatus(useImage ? 'Initializing ComfyUI with image…' : 'Initializing ComfyUI for text-to-image…');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/comfyui/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: useImage ? imageId : undefined,
          config,
          useImage: useImage,
          width: 1024,
          height: 1024,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to start ComfyUI processing');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'status' && data.data) {
                const statusText = String(data.data);
                setStatus(statusText);
                const downloadMatch = statusText.match(/Downloading model: (\d+)%/);
                if (downloadMatch) {
                  setProgress(parseInt(downloadMatch[1], 10));
                }
              } else if (data.type === 'progress' && typeof data.data === 'number') {
                setProgress(data.data);
              } else if (data.type === 'image' && data.data) {
                setResultImage(data.data);
                setProgress(100);
                setStatus('Processing complete!');
                setIsProcessing(false);
                return;
              } else if (data.type === 'done') {
                setProgress(100);
                setStatus('Processing complete!');
                setIsProcessing(false);
                return;
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Unknown error');
              }
            } catch (e) {
              console.warn('[ComfyUIProgress] Failed to parse message:', line, e);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error(err.message);
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="space-y-5">
      {isProcessing && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{status || 'Processing…'}</span>
              <span className="tabular-nums text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{status || 'Working…'}</span>
          </div>
        </div>
      )}

      {resultImage && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
            <img
              src={resultImage}
              alt="Processed result"
              className="mx-auto max-h-[70vh] w-full object-contain"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onProcessingComplete(resultImage)} disabled={disabled}>
              View result
              <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {!isProcessing && !resultImage && (
        <div className="space-y-5">
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Ready to process</p>
          </div>

          {imageId && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="useImage"
                  checked={useImage}
                  onCheckedChange={(value) => setUseImage(value === true)}
                  disabled={isProcessing}
                />
                <Label htmlFor="useImage" className="cursor-pointer font-normal">
                  Use uploaded image (img2img)
                </Label>
              </div>
              <span className="text-xs text-muted-foreground">
                {useImage ? 'Reinterpret the upload' : 'Generate from prompt only'}
              </span>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={startProcessing}
            disabled={disabled || isProcessing || !config}
          >
            {useImage ? 'Process image' : 'Generate from prompt'}
          </Button>
        </div>
      )}
    </div>
  );
}
