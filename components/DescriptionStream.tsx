'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Loader2, ArrowRight } from 'lucide-react';

interface DescriptionStreamProps {
  imageId: string | null;
  onDescriptionComplete: (description: string) => void;
  disabled?: boolean;
}

export function DescriptionStream({ imageId, onDescriptionComplete, disabled }: DescriptionStreamProps) {
  const [description, setDescription] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (imageId && !disabled) {
      startDescription();
    } else {
      setDescription('');
      setError(null);
    }

    return () => {
      if (abortControllerRef.current && !imageId) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId, disabled]);

  const startDescription = async () => {
    if (!imageId) return;

    setIsStreaming(true);
    setError(null);
    setDescription('');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to start description generation');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (isStreaming && description) {
            console.warn('[DescriptionStream] Stream ended without done message, but we have description text');
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'token' && data.data) {
                setDescription(prev => prev + data.data);
              } else if (data.type === 'done') {
                const finalDescription = typeof data.data === 'string' ? data.data : description;
                if (finalDescription && finalDescription.trim()) {
                  setDescription(finalDescription);
                  setIsStreaming(false);
                  return;
                } else {
                  throw new Error('Invalid description format received');
                }
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Unknown error');
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.warn('[DescriptionStream] Failed to parse SSE line:', line.substring(0, 100));
              } else {
                throw e;
              }
            }
          }
        }
      }

      if (isStreaming) {
        if (description && description.length > 0) {
          setIsStreaming(false);
        } else {
          setError('Stream ended without a response. The model may not be responding — ensure it exists: ollama list');
          setIsStreaming(false);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
        setIsStreaming(false);
      } else if (err instanceof Error && err.name === 'AbortError') {
        setIsStreaming(false);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(description);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isStreaming ? 'Generating prompt…' : 'The generated prompt will appear here'}
          className="min-h-[240px] font-mono text-[13px] leading-relaxed"
          readOnly={isStreaming}
        />
        {isStreaming && (
          <div className="absolute right-3 top-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {isStreaming ? 'Streaming…' : description ? `${description.length} characters` : 'Waiting for image'}
        </span>
        {description && !isStreaming && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={copyToClipboard}>
              <Copy />
              Copy
            </Button>
            <Button size="sm" onClick={() => onDescriptionComplete(description)} disabled={isStreaming}>
              Continue
              <ArrowRight />
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-muted-foreground">{error}</p>}
    </div>
  );
}
