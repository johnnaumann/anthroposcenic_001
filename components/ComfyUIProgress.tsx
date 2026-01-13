'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Image as ImageIcon } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [useImage, setUseImage] = useState<boolean>(true); // Default to img2img if image available
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Set default useImage based on whether imageId is available
    if (imageId) {
      setUseImage(true);
    }
  }, [imageId]);

  useEffect(() => {
    // Don't auto-start - wait for user to click process button
    // if (imageId && config && !disabled) {
    //   startProcessing();
    // } else {
    //   reset();
    // }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [imageId, config, disabled]);

  const reset = () => {
    setStatus('');
    setProgress(0);
    setResultImage(null);
    setIsProcessing(false);
    setError(null);
  };

  const startProcessing = async () => {
    if (!config) return;
    
    // If useImage is true, imageId is required
    if (useImage && !imageId) {
      setError('Image is required for image-to-image mode');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setStatus(useImage ? 'Initializing ComfyUI with image...' : 'Initializing ComfyUI for text-to-image...');

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
              
              console.log('[ComfyUIProgress] Received message:', data.type, data);
              
              if (data.type === 'status' && data.data) {
                const statusText = String(data.data);
                setStatus(statusText);
                // If status indicates download progress, try to extract percentage
                const downloadMatch = statusText.match(/Downloading model: (\d+)%/);
                if (downloadMatch) {
                  const percent = parseInt(downloadMatch[1], 10);
                  setProgress(percent);
                }
              } else if (data.type === 'progress' && typeof data.data === 'number') {
                setProgress(data.data);
              } else if (data.type === 'image' && data.data) {
                console.log('[ComfyUIProgress] Setting result image:', data.data);
                setResultImage(data.data);
                setProgress(100);
                setStatus('Processing complete!');
                onProcessingComplete(data.data);
                setIsProcessing(false);
                return;
              } else if (data.type === 'done') {
                // If we get 'done' but no image yet, check if we have an image URL from a previous message
                if (!resultImage) {
                  console.warn('[ComfyUIProgress] Received done but no image was set');
                }
                setProgress(100);
                setStatus('Processing complete!');
                setIsProcessing(false);
                return;
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Unknown error');
              }
            } catch (e) {
              // Skip invalid JSON
              console.warn('[ComfyUIProgress] Failed to parse message:', line, e);
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
          <div className="space-y-4">
            <div className="text-center py-4 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Ready to process</p>
            </div>
            
            {imageId && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useImage"
                    checked={useImage}
                    onChange={(e) => setUseImage(e.target.checked)}
                    disabled={isProcessing}
                    className="w-4 h-4"
                  />
                  <label htmlFor="useImage" className="text-sm cursor-pointer">
                    Use uploaded image (img2img)
                  </label>
                </div>
                <div className="text-xs text-muted-foreground">
                  {useImage ? 'Will modify the uploaded image' : 'Will generate from description only'}
                </div>
              </div>
            )}
            
            <button
              onClick={startProcessing}
              disabled={disabled || isProcessing || !config}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {useImage ? 'Process Image' : 'Generate from Description'}
            </button>
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
