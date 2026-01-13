'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ComfyUIProgress } from '@/components/ComfyUIProgress';
import { PipelineStatus } from '@/components/PipelineStatus';
import { ComfyUIConfig } from '@/types';

function ProcessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const configParam = searchParams.get('config');
  const [config, setConfig] = useState<ComfyUIConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageId || !configParam) {
      router.push('/upload');
      return;
    }
    try {
      const decodedConfig = JSON.parse(decodeURIComponent(configParam)) as ComfyUIConfig;
      setConfig(decodedConfig);
    } catch (e) {
      console.error('Failed to parse config:', e);
      router.push('/upload');
    }
  }, [imageId, configParam, router]);

  const handleProcessingComplete = (imageUrl: string) => {
    // Navigate to complete step
    router.push(`/complete?imageUrl=${encodeURIComponent(imageUrl)}`);
  };

  if (!imageId || !config) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Anthroposcenic</h1>
          <p className="text-muted-foreground">
            Step 5: Processing image with ComfyUI
          </p>
        </div>

        <div className="mb-6">
          <PipelineStatus step="process" error={error || undefined} />
        </div>

        <div className="space-y-6">
          <ComfyUIProgress
            imageId={imageId}
            config={config}
            onProcessingComplete={handleProcessingComplete}
            disabled={false}
          />
        </div>
      </div>
    </main>
  );
}

export default function ProcessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading...</div>
      </main>
    }>
      <ProcessContent />
    </Suspense>
  );
}
