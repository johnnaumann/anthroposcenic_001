'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Image as ImageIcon } from 'lucide-react';

interface ComfyUIProgressProps {
  imageId: string | null;
  description: string | null;
  onProcessingComplete: (imageUrl: string) => void;
  disabled?: boolean;
}

export function ComfyUIProgress({ imageId, description, onProcessingComplete, disabled }: ComfyUIProgressProps) {
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (imageId && description && !disabled) {
      startProcessing();
    } else {
      reset();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [imageId, description, disabled]);

  const reset = () => {
    setStatus('');
    setProgress(0);
    setResultImage(null);
    setIsProcessing(false);
    setError(null);
  };

  const startProcessing = async () => {
    if (!imageId || !description) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setStatus('Initializing...');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/comfyui/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, description }),
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
                setStatus(data.data);
              } else if (data.type === 'progress' && typeof data.data === 'number') {
                setProgress(data.data);
              } else if (data.type === 'image' && data.data) {
                setResultImage(data.data);
                setProgress(100);
                setStatus('Processing complete!');
                onProcessingComplete(data.data);
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
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
        setIsProcessing(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ComfyUI Processing</CardTitle>
        <CardDescription>
          Processing image with ComfyUI based on description
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isProcessing && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{status || 'Processing...'}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
            {status && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            )}
          </>
        )}

        {resultImage && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Result:</div>
            <div className="border rounded-lg overflow-hidden">
              <img
                src={resultImage}
                alt="Processed result"
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {!isProcessing && !resultImage && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Waiting for image and description...</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
