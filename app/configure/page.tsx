'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConfigSelector } from '@/components/ConfigSelector';
import { ContentCard, PageShell, PageLoader, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { ComfyUIConfig } from '@/types';
import { loadPipelineDescription, savePipelineConfig } from '@/lib/pipeline-storage';

function ConfigureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const isBlend = searchParams.get('mode') === 'blend';
  const [description, setDescription] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDescription(loadPipelineDescription());
    setReady(true);
  }, []);

  const handleConfigSelected = (config: ComfyUIConfig) => {
    savePipelineConfig(config);
    router.push(isBlend ? '/process?mode=blend' : `/process?imageId=${imageId}`);
  };

  if (!ready) {
    return (
      <PageShell>
        <PageLoader label="Loading prompt…" />
      </PageShell>
    );
  }

  if ((!isBlend && !imageId) || !description) {
    return (
      <PageShell error="Missing image or description. Please start from the upload step.">
        <ContentCard>
          <Button variant="outline" onClick={() => router.push('/upload')}>
            Go to upload
          </Button>
        </ContentCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ConfigSelector
        description={description}
        onConfigSelected={handleConfigSelected}
        disabled={false}
      />
    </PageShell>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ConfigureContent />
    </Suspense>
  );
}
