'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ComfyUIConfig, ProcessingProgressData } from '@/types';

interface ComfyUIProgressProps {
  imageId: string | null;
  config: ComfyUIConfig | null;
  onProcessingComplete: (imageUrl: string) => void;
  disabled?: boolean;
}

function isProgressData(data: unknown): data is ProcessingProgressData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'overall' in data &&
    'phaseLabel' in data
  );
}

function formatProgressDetail(progress: ProcessingProgressData | null): string {
  if (!progress) return '';

  const parts: string[] = [];

  if (progress.phaseCount > 1) {
    parts.push(`Step ${progress.phaseIndex} of ${progress.phaseCount}`);
  }

  parts.push(progress.phaseLabel);

  if (
    typeof progress.step === 'number' &&
    typeof progress.stepMax === 'number' &&
    progress.stepMax > 0
  ) {
    parts.push(`${progress.step}/${progress.stepMax}`);
  }

  return parts.join(' · ');
}

export function ComfyUIProgress({ imageId, config, onProcessingComplete, disabled }: ComfyUIProgressProps) {
  const [status, setStatus] = useState('Starting…');
  const [progressDetail, setProgressDetail] = useState('');
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(true);
  const [failed, setFailed] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);

  const startProcessing = useCallback(async () => {
    if (!config) return;

    if (!imageId) {
      toast.error('Image is required for processing');
      setFailed(true);
      setIsProcessing(false);
      return;
    }

    setFailed(false);
    setIsProcessing(true);
    setProgress(0);
    setProgressDetail('');
    setStatus('Initializing ComfyUI…');

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/comfyui/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId,
          config,
          useImage: true,
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
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'status' && data.data) {
              setStatus(String(data.data));
            } else if (data.type === 'progress') {
              if (isProgressData(data.data)) {
                setProgress(data.data.overall);
                setProgressDetail(formatProgressDetail(data.data));
              } else if (typeof data.data === 'number') {
                setProgress(data.data);
              }
            } else if (data.type === 'image' && data.data) {
              onProcessingComplete(data.data);
              return;
            } else if (data.type === 'done') {
              return;
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Unknown error');
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              console.warn('[ComfyUIProgress] Failed to parse message:', line, e);
            } else {
              throw e;
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error(err.message);
        setFailed(true);
        setIsProcessing(false);
      }
    }
  }, [config, imageId, onProcessingComplete]);

  useEffect(() => {
    if (!config || disabled || hasStartedRef.current) return;
    hasStartedRef.current = true;
    startProcessing();
  }, [config, disabled, startProcessing]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-muted-foreground">Processing did not complete.</p>
        <Button onClick={() => startProcessing()} disabled={disabled}>
          Try again
        </Button>
      </div>
    );
  }

  const primaryLabel = progressDetail || status;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="min-w-0 text-muted-foreground">{primaryLabel}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} />
        {progressDetail && status !== progressDetail && (
          <p className="text-xs text-muted-foreground">{status}</p>
        )}
      </div>
      {isProcessing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Processing image…</span>
        </div>
      )}
    </div>
  );
}
