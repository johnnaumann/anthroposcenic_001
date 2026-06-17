'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConfigSelector } from '@/components/ConfigSelector';
import { ContentCard, PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ComfyUIConfig } from '@/types';
import { loadPipelineDescription, savePipelineConfig } from '@/lib/pipeline-storage';

function ConfigureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const isBlend = searchParams.get('mode') === 'blend';
  const descriptionParam = searchParams.get('description');
  const [description, setDescription] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromUrl = descriptionParam ? decodeURIComponent(descriptionParam) : null;
    const fromStorage = loadPipelineDescription();
    setDescription(fromUrl ?? fromStorage);
    setReady(true);
  }, [descriptionParam]);

  const handleConfigSelected = (config: ComfyUIConfig) => {
    savePipelineConfig(config);
    router.push(isBlend ? '/process?mode=blend' : `/process?imageId=${imageId}`);
  };

  if (!ready) {
    return (
      <PageShell>
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading prompt…
        </div>
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
