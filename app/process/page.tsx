'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ComfyUIProgress } from '@/components/ComfyUIProgress';
import { PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { ComfyUIConfig } from '@/types';
import { toast } from 'sonner';

function ProcessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const configParam = searchParams.get('config');
  const [config, setConfig] = useState<ComfyUIConfig | null>(null);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (configParam) {
      try {
        const decodedConfig = JSON.parse(decodeURIComponent(configParam)) as ComfyUIConfig;
        setConfig(decodedConfig);
        setConfigError(false);
      } catch (e) {
        console.error('Failed to parse config:', e);
        toast.error('Failed to read the configuration. Please go back and reconfigure.');
        setConfigError(true);
      }
    }
  }, [configParam]);

  const handleProcessingComplete = (imageUrl: string) => {
    router.push(`/complete?imageUrl=${encodeURIComponent(imageUrl)}`);
  };

  if (!imageId || (!config && !configError)) {
    return (
      <PageShell error="Missing image or configuration. Please go back and configure settings.">
        <Button variant="outline" onClick={() => router.push('/upload')}>
          Go to upload
        </Button>
      </PageShell>
    );
  }

  if (configError || !config) {
    return (
      <PageShell>
        <Button variant="outline" onClick={() => router.push('/configure')}>
          Go to configure
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ComfyUIProgress
        imageId={imageId}
        config={config}
        onProcessingComplete={handleProcessingComplete}
        disabled={false}
      />
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
