'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PipelineStatus } from '@/components/PipelineStatus';
import { Button } from '@/components/ui/button';

function CompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageUrl = searchParams.get('imageUrl');
  const [error, setError] = useState<string | null>(null);

  // No auto-redirect - show error message if imageUrl is missing

  const handleReset = () => {
    router.push('/upload');
  };

  if (!imageUrl) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Anthroposcenic</h1>
            <p className="text-muted-foreground">Processing complete!</p>
          </div>
          <div className="mb-6">
            <PipelineStatus step="complete" error="Image URL is missing" />
          </div>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No image URL provided. Please start from the upload step.</p>
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
            Processing complete!
          </p>
        </div>

        <div className="mb-6">
          <PipelineStatus step="complete" error={error || undefined} />
        </div>

        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full max-w-2xl aspect-square border rounded-lg overflow-hidden bg-muted">
              <img
                src={imageUrl}
                alt="Processed result"
                className="w-full h-full object-contain"
              />
            </div>
            
            <div className="flex gap-4">
              <Button onClick={handleReset}>
                Process Another Image
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(imageUrl, '_blank')}
              >
                Open Full Size
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading...</div>
      </main>
    }>
      <CompleteContent />
    </Suspense>
  );
}
