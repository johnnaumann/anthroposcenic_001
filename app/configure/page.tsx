'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ConfigSelector } from '@/components/ConfigSelector';
import { PipelineStatus } from '@/components/PipelineStatus';
import { Button } from '@/components/ui/button';
import { ComfyUIConfig } from '@/types';

function ConfigureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const descriptionParam = searchParams.get('description');
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (descriptionParam) {
      setDescription(decodeURIComponent(descriptionParam));
    }
  }, [descriptionParam]);

  const handleConfigSelected = (config: ComfyUIConfig) => {
    // Navigate to process step with all data
    const configJson = encodeURIComponent(JSON.stringify(config));
    router.push(`/process?imageId=${imageId}&config=${configJson}`);
  };

  if (!imageId || !descriptionParam) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Anthroposcenic</h1>
            <p className="text-muted-foreground">Step 4: Configure ComfyUI settings</p>
          </div>
          <div className="mb-6">
            <PipelineStatus step="configure" error="Image ID or description is missing" />
          </div>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Missing required information. Please start from the upload step.</p>
            <Button onClick={() => router.push('/upload')}>Go to Upload</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Anthroposcenic</h1>
          <p className="text-muted-foreground">
            Step 4: Configure ComfyUI settings
          </p>
        </div>

        <div className="mb-6">
          <PipelineStatus step="configure" error={error || undefined} />
        </div>

        <div className="space-y-6">
          <ConfigSelector
            description={description}
            onConfigSelected={handleConfigSelected}
            disabled={false}
          />
        </div>
      </div>
    </main>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading...</div>
      </main>
    }>
      <ConfigureContent />
    </Suspense>
  );
}
