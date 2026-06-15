'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ComfyUIConfig, ProcessingProgressData } from '@/types';
import {
  abortComfyUIProcess,
  subscribeComfyUIProcess,
} from '@/lib/comfyui-process-stream';

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

function parseStatusProgress(statusText: string): number | null {
  const downloadMatch = statusText.match(/Downloading model: (\d+)%/);
  if (downloadMatch) {
    return parseInt(downloadMatch[1], 10);
  }
  return null;
}

export function ComfyUIProgress({ imageId, config, onProcessingComplete, disabled }: ComfyUIProgressProps) {
  const [status, setStatus] = useState('Starting…');
  const [progressDetail, setProgressDetail] = useState('');
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const processKey = useMemo(
    () => (imageId ? `${imageId}:${retryKey}` : null),
    [imageId, retryKey]
  );

  const retry = useCallback(() => {
    if (processKey) {
      abortComfyUIProcess(processKey);
    }
    setFailed(false);
    setRetryKey((key) => key + 1);
  }, [processKey]);

  useEffect(() => {
    if (!config || disabled || !imageId || !processKey) return;

    setFailed(false);
    setIsProcessing(true);
    setProgress(0);
    setProgressDetail('');
    setStatus('Initializing ComfyUI…');

    const unsubscribe = subscribeComfyUIProcess(
      processKey,
      {
        imageId,
        config,
        useImage: true,
        width: 1024,
        height: 1024,
      },
      (event) => {
        if (event.type === 'status') {
          setStatus(event.data);
          const statusProgress = parseStatusProgress(event.data);
          if (statusProgress !== null) {
            setProgress(statusProgress);
          }
        } else if (event.type === 'progress') {
          if (isProgressData(event.data)) {
            setProgress(event.data.overall);
            setProgressDetail(formatProgressDetail(event.data));
          } else if (typeof event.data === 'number') {
            setProgress(event.data);
          }
        } else if (event.type === 'image') {
          setIsProcessing(false);
          onProcessingComplete(event.data);
        } else if (event.type === 'done') {
          setIsProcessing(false);
        } else if (event.type === 'meta') {
          // Handled by the shared process stream for recovery polling.
        } else if (event.type === 'error') {
          toast.error(event.error);
          setFailed(true);
          setIsProcessing(false);
        }
      }
    );

    return unsubscribe;
  }, [config, disabled, imageId, onProcessingComplete, processKey]);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-muted-foreground">Processing did not complete.</p>
        <Button onClick={retry} disabled={disabled}>
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
