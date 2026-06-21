'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ContentCard, PageCenter } from '@/components/PageShell';
import { Copy, Loader2, ArrowRight } from 'lucide-react';
import { countPromptWords } from '@/lib/prompt-limits';
import { parseSSEDataLine, readFetchSSEStream } from '@/lib/streaming';
import { toast } from 'sonner';

interface DescriptionStreamProps {
  imageId: string | null;
  imageIds?: string[] | null; // blend mode: describe several sources into one prompt
  onDescriptionComplete: (description: string) => void;
  disabled?: boolean;
}

export function DescriptionStream({ imageId, imageIds, onDescriptionComplete, disabled }: DescriptionStreamProps) {
  const [description, setDescription] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // One source (single image) or many (blend several archive pieces into one prompt).
  const sources = imageIds && imageIds.length > 0 ? imageIds : imageId ? [imageId] : [];
  const sourcesKey = sources.join(',');
  const isBlend = sources.length > 1;

  useEffect(() => {
    if (sources.length > 0 && !disabled) {
      startDescription();
    } else {
      setDescription('');
    }

    return () => {
      if (abortControllerRef.current && sources.length === 0) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey, disabled]);

  const startDescription = async () => {
    if (sources.length === 0) return;

    setIsStreaming(true);
    setDescription('');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isBlend ? { imageIds: sources } : { imageId: sources[0] }),
        signal: abortControllerRef.current.signal,
      });

      await readFetchSSEStream(response, {
        errorMessage: 'Failed to start description generation',
        onLine: (line) => {
          try {
            const data = parseSSEDataLine(line);
            if (!data) {
              return;
            }

            if (data.type === 'token' && data.data) {
              setDescription((prev) => prev + String(data.data));
            } else if (data.type === 'done') {
              const finalDescription =
                typeof data.data === 'string' ? data.data : description;
              if (finalDescription && finalDescription.trim()) {
                setDescription(finalDescription);
                setIsStreaming(false);
                return true;
              }

              throw new Error('Invalid description format received');
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Unknown error');
            }
          } catch (error) {
            if (error instanceof SyntaxError) {
              console.warn('[DescriptionStream] Failed to parse SSE line:', line.substring(0, 100));
              return;
            }

            throw error;
          }
        },
      });

      if (isStreaming) {
        if (description && description.length > 0) {
          setIsStreaming(false);
        } else {
          toast.error('Stream ended without a response. The model may not be responding — ensure it exists: ollama list');
          setIsStreaming(false);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error(err.message);
        setIsStreaming(false);
      } else if (err instanceof Error && err.name === 'AbortError') {
        setIsStreaming(false);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(description);
  };

  // Silent "thinking" phase (qwen3-vl reasons before emitting any text) — show a
  // friendly state instead of a bare spinner so it doesn't read as stuck.
  if (isStreaming && !description) {
    return (
      <PageCenter className="gap-4 px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {isBlend ? `Blending ${sources.length} artworks…` : 'Reading the artwork…'}
          </p>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
            {isBlend
              ? 'Fusing their styles, moods, palettes and forms into one imagined prompt. This can take ~30–60s with the high-detail model.'
              : 'Studying style, mood, composition and technique to write a prompt worth riffing on. This can take ~30–60s with the high-detail model.'}
          </p>
        </div>
      </PageCenter>
    );
  }

  return (
    <ContentCard className="space-y-4">
      <div className="relative">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="The generated prompt will appear here"
          className="min-h-[200px] resize-none text-sm leading-relaxed"
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
          {isStreaming
            ? `Writing… · ${countPromptWords(description)} words`
            : description
              ? `${countPromptWords(description)} words`
              : 'Waiting for image'}
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
    </ContentCard>
  );
}
