'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DescriptionEditor } from '@/components/DescriptionEditor';
import { PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';

function EditContent() {
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

  const handleNext = () => {
    if (description.trim()) {
      const encodedDescription = encodeURIComponent(description);
      router.push(`/configure?imageId=${imageId}&description=${encodedDescription}`);
    }
  };

  if (!imageId || !descriptionParam) {
    return (
      <PageShell error="Missing image or description. Please start from the upload step.">
        <Button variant="outline" onClick={() => router.push('/upload')}>
          Go to upload
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <DescriptionEditor
        description={description}
        onDescriptionChange={setDescription}
        onNext={handleNext}
        disabled={false}
      />
    </PageShell>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <EditContent />
    </Suspense>
  );
}
