'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUploadZone } from '@/components/ImageUploadZone';
import { PipelineStatus } from '@/components/PipelineStatus';
import { UploadResponse } from '@/types';

export default function UploadPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = (response: UploadResponse) => {
    // Navigate to describe step with imageId
    router.push(`/describe?imageId=${response.imageId}`);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Anthroposcenic</h1>
          <p className="text-muted-foreground">
            Step 1: Upload and compress your image
          </p>
        </div>

        <div className="mb-6">
          <PipelineStatus step="upload" error={error || undefined} />
        </div>

        <div className="space-y-6">
          <ImageUploadZone
            onUploadComplete={handleUploadComplete}
            onRemove={() => router.push('/upload')}
            imageId={null}
            disabled={false}
          />
        </div>
      </div>
    </main>
  );
}
