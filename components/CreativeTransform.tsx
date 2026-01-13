'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Loader2, Sparkles } from 'lucide-react';

interface CreativeTransformProps {
  imageId: string | null;
  originalDescription: string | null;
  onTransformComplete: (transformedDescription: string) => void;
  disabled?: boolean;
}

export function CreativeTransform({ 
  imageId, 
  originalDescription, 
  onTransformComplete, 
  disabled 
}: CreativeTransformProps) {
  const [transformedDescription, setTransformedDescription] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Reset state when dependencies change
    if (!imageId || !originalDescription || disabled) {
      if (!imageId) console.log('[CreativeTransform] Waiting for imageId');
      if (!originalDescription) console.log('[CreativeTransform] Waiting for originalDescription, current config description:', originalDescription);
      if (disabled) console.log('[CreativeTransform] Component is disabled');
      setTransformedDescription('');
      setError(null);
      return;
    }

    // All conditions met, start transformation
    console.log('[CreativeTransform] Starting transformation with description length:', originalDescription.length);
    startTransformation();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId, originalDescription, disabled]);

  const startTransformation = async () => {
    if (!imageId || !originalDescription) return;

    setIsTransforming(true);
    setError(null);
    setTransformedDescription('');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageId, 
          originalDescription 
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Failed to start transformation: ${response.status} ${errorText || response.statusText}`);
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
              
              if (data.type === 'token' && data.data) {
                setTransformedDescription(prev => prev + data.data);
              } else if (data.type === 'done' && data.data) {
                const finalDescription = typeof data.data === 'string' ? data.data : transformedDescription;
                setTransformedDescription(finalDescription);
                onTransformComplete(finalDescription);
                setIsTransforming(false);
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
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Transformation was cancelled or timed out');
        } else {
          setError(err.message);
        }
        setIsTransforming(false);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transformedDescription);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Scientific Transformation
        </CardTitle>
        <CardDescription>
          Transforming the description using scientific analogies and comparisons to natural phenomena
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {originalDescription && (
          <div className="p-3 bg-muted rounded-md text-sm">
            <div className="font-semibold mb-1">Original Description:</div>
            <div className="text-muted-foreground line-clamp-3">{originalDescription}</div>
          </div>
        )}
        
        <div className="relative">
          <Textarea
            value={transformedDescription}
            onChange={(e) => setTransformedDescription(e.target.value)}
            placeholder={isTransforming ? 'Transforming description using scientific analogies...' : 'Scientific description will appear here'}
            className="min-h-[200px] font-mono text-sm"
            readOnly={isTransforming}
          />
          {isTransforming && (
            <div className="absolute top-2 right-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isTransforming ? 'Applying scientific analogies...' : transformedDescription ? 'Transformation complete' : 'Waiting for original description'}
          </div>
          <div className="flex gap-2">
            {transformedDescription && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                disabled={!transformedDescription}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            )}
          </div>
        </div>
        {error && (
          <div className="p-3 bg-muted text-foreground/80 border border-foreground/20 text-sm rounded-md">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
