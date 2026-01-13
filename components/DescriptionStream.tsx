'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Loader2 } from 'lucide-react';
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
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
          console.log('[DescriptionStream] Stream ended');
          // If stream ended but we didn't get a done message, check if we have accumulated description
          if (isStreaming && description && !config) {
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
                console.log('[DescriptionStream] Received done message');
                // data.data should be the description string
                const finalDescription = typeof data.data === 'string' ? data.data : description;
                if (finalDescription && finalDescription.trim()) {
                  setDescription(finalDescription);
                  onDescriptionComplete(finalDescription);
                  setIsStreaming(false);
                  return;
                } else {
                  throw new Error('Invalid description format received');
                }
              } else if (data.type === 'error') {
                console.error('[DescriptionStream] Error received:', data.error);
                throw new Error(data.error || 'Unknown error');
              }
            } catch (e) {
              // Log parsing errors for debugging
              if (e instanceof SyntaxError) {
                console.warn('[DescriptionStream] Failed to parse SSE line:', line.substring(0, 100));
              } else {
                console.error('[DescriptionStream] Error processing message:', e);
                throw e;
              }
            }
          }
        }
      }
      
      // If we reach here and still streaming, the stream ended without a done message
      if (isStreaming) {
        console.warn('[DescriptionStream] Stream ended without done message');
        if (description && description.length > 0) {
          console.warn('[DescriptionStream] We have description text but no config. This suggests JSON parsing failed on the server.');
          setError('Received description but failed to parse configuration. Check server logs. You may need to recreate the model: npm run ollama:modelfile');
        } else {
          setError('Stream ended without response. The model may not be responding. Please ensure the model is created: npm run ollama:modelfile');
        }
        setIsStreaming(false);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[DescriptionStream] Error:', err);
        setError(err.message);
        setIsStreaming(false);
      } else if (err instanceof Error && err.name === 'AbortError') {
        console.log('[DescriptionStream] Request aborted');
        setIsStreaming(false);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(description);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Analysis & Configuration</CardTitle>
        <CardDescription>
          AI-generated description and ComfyUI configuration from Ollama
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isStreaming ? 'Generating description and configuration...' : 'Description and configuration will appear here'}
            className="min-h-[200px] font-mono text-sm"
            readOnly={isStreaming}
          />
          {isStreaming && (
            <div className="absolute top-2 right-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isStreaming ? 'Streaming...' : description ? 'Description ready' : 'Waiting for image'}
          </div>
          <div className="flex gap-2">
            {description && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                disabled={!description}
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
