'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DescriptionEditor } from '@/components/DescriptionEditor';
import { PipelineStatus } from '@/components/PipelineStatus';
import { Button } from '@/components/ui/button';

function EditContent() {
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

  const handleDescriptionChange = (desc: string) => {
    setDescription(desc);
  };

  const handleNext = () => {
    if (description.trim()) {
      const encodedDescription = encodeURIComponent(description);
      router.push(`/configure?imageId=${imageId}&description=${encodedDescription}`);
    }
  };

  if (!imageId || !descriptionParam) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Anthroposcenic</h1>
            <p className="text-muted-foreground">Step 3: Edit the description</p>
          </div>
          <div className="mb-6">
            <PipelineStatus step="edit" error="Image ID or description is missing" />
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
            Step 3: Edit the description
          </p>
        </div>

        <div className="mb-6">
          <PipelineStatus step="edit" error={error || undefined} />
        </div>

        <div className="space-y-6">
          <DescriptionEditor
            description={description}
            onDescriptionChange={handleDescriptionChange}
            onNext={handleNext}
            disabled={false}
          />
        </div>
      </div>
    </main>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading...</div>
      </main>
    }>
      <EditContent />
    </Suspense>
  );
}
