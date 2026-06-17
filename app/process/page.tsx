'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ComfyUIProgress } from '@/components/ComfyUIProgress';
import { ContentCard, PageShell, PageLoader, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { ComfyUIConfig } from '@/types';
import {
  loadPipelineConfig,
} from '@/lib/pipeline-storage';

function ProcessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const isBlend = searchParams.get('mode') === 'blend';
  const [config, setConfig] = useState<ComfyUIConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConfig(loadPipelineConfig());
    setReady(true);
  }, []);

  const handleProcessingComplete = useCallback((imageUrl: string) => {
    const params = new URLSearchParams({ imageUrl });
    if (imageId) params.set('imageId', imageId); // carry the source for a before/after view
    router.push(`/complete?${params.toString()}`);
  }, [router, imageId]);

  if (!ready) {
    return (
      <PageShell>
        <PageLoader label="Loading configuration…" />
      </PageShell>
    );
  }

  if (!isBlend && !imageId) {
    return (
      <PageShell error="Missing image. Please start from the upload step.">
        <ContentCard>
          <Button variant="outline" onClick={() => router.push('/upload')}>
            Go to upload
          </Button>
        </ContentCard>
      </PageShell>
    );
  }

  if (!config) {
    return (
      <PageShell error="Missing configuration. Please go back and configure settings.">
        <ContentCard>
          <Button
            variant="outline"
            onClick={() => router.push(isBlend ? '/configure?mode=blend' : `/configure?imageId=${imageId}`)}
          >
            Go to configure
          </Button>
        </ContentCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ContentCard>
        <ComfyUIProgress
          imageId={isBlend ? null : imageId}
          useImage={!isBlend}
          config={config}
          onProcessingComplete={handleProcessingComplete}
          disabled={false}
        />
      </ContentCard>
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
