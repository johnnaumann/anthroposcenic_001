'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DescriptionStream } from '@/components/DescriptionStream';
import { PipelineStatus } from '@/components/PipelineStatus';

function DescribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageId) {
      router.push('/upload');
    }
  }, [imageId, router]);

  const handleDescriptionComplete = (description: string) => {
    // Navigate to edit step with imageId and description
    const encodedDescription = encodeURIComponent(description);
    router.push(`/edit?imageId=${imageId}&description=${encodedDescription}`);
  };

  if (!imageId) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Anthroposcenic</h1>
          <p className="text-muted-foreground">
            Step 2: Describe the image using AI
          </p>
        </div>

        <div className="mb-6">
          <PipelineStatus step="describe" error={error || undefined} />
        </div>

        <div className="space-y-6">
          <DescriptionStream
            imageId={imageId}
            onDescriptionComplete={handleDescriptionComplete}
            disabled={false}
          />
        </div>
      </div>
    </main>
  );
}

export default function DescribePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading...</div>
      </main>
    }>
      <DescribeContent />
    </Suspense>
  );
}
