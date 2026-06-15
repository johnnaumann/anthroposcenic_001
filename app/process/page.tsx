'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ComfyUIProgress } from '@/components/ComfyUIProgress';
import { ContentCard, PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ComfyUIConfig } from '@/types';
import {
  loadPipelineConfig,
  parsePipelineConfigParam,
  savePipelineConfig,
} from '@/lib/pipeline-storage';

function ProcessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const configParam = searchParams.get('config');
  const [config, setConfig] = useState<ComfyUIConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let resolvedConfig: ComfyUIConfig | null = null;

    if (configParam) {
      resolvedConfig = parsePipelineConfigParam(configParam);
      if (resolvedConfig) {
        savePipelineConfig(resolvedConfig);
      }
    }

    if (!resolvedConfig) {
      resolvedConfig = loadPipelineConfig();
    }

    setConfig(resolvedConfig);
    setReady(true);
  }, [configParam]);

  const handleProcessingComplete = useCallback((imageUrl: string) => {
    const params = new URLSearchParams({ imageUrl });
    if (imageId) params.set('imageId', imageId); // carry the source for a before/after view
    router.push(`/complete?${params.toString()}`);
  }, [router, imageId]);

  if (!ready) {
    return (
      <PageShell>
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading configuration…
        </div>
      </PageShell>
    );
  }

  if (!imageId) {
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
            onClick={() => router.push(`/configure?imageId=${imageId}`)}
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
          imageId={imageId}
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
