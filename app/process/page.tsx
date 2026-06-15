'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ComfyUIProgress } from '@/components/ComfyUIProgress';
import { PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { ComfyUIConfig } from '@/types';

function ProcessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const configParam = searchParams.get('config');
  const [config, setConfig] = useState<ComfyUIConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configParam) {
      try {
        const decodedConfig = JSON.parse(decodeURIComponent(configParam)) as ComfyUIConfig;
        setConfig(decodedConfig);
      } catch (e) {
        console.error('Failed to parse config:', e);
        setError('Failed to read the configuration. Please go back and reconfigure.');
      }
    }
  }, [configParam]);

  const handleProcessingComplete = (imageUrl: string) => {
    router.push(`/complete?imageUrl=${encodeURIComponent(imageUrl)}`);
  };

  if (!imageId || (!config && !error)) {
    return (
      <PageShell error="Missing image or configuration. Please go back and configure settings.">
        <Button variant="outline" onClick={() => router.push('/upload')}>
          Go to upload
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell error={error || undefined}>
      {config && (
        <ComfyUIProgress
          imageId={imageId}
          config={config}
          onProcessingComplete={handleProcessingComplete}
          disabled={false}
        />
      )}
    </PageShell>
  );
}

export default function ProcessPage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ProcessContent />
    </Suspense>
  );
}
