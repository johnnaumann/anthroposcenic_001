'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConfigSelector } from '@/components/ConfigSelector';
import { PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { ComfyUIConfig } from '@/types';

function ConfigureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const descriptionParam = searchParams.get('description');
  const [description, setDescription] = useState<string>('');

  useEffect(() => {
    if (descriptionParam) {
      setDescription(decodeURIComponent(descriptionParam));
    }
  }, [descriptionParam]);

  const handleConfigSelected = (config: ComfyUIConfig) => {
    const configJson = encodeURIComponent(JSON.stringify(config));
    router.push(`/process?imageId=${imageId}&config=${configJson}`);
  };

  if (!imageId || !descriptionParam) {
    return (
      <PageShell step="configure" error="Missing image or description. Please start from the upload step.">
        <Button variant="outline" onClick={() => router.push('/upload')}>
          Go to upload
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell step="configure">
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
