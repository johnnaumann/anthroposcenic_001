'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DescriptionStream } from '@/components/DescriptionStream';
import { PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';

function DescribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');

  const handleDescriptionComplete = (description: string) => {
    const encodedDescription = encodeURIComponent(description);
    router.push(`/configure?imageId=${imageId}&description=${encodedDescription}`);
  };

  if (!imageId) {
    return (
      <PageShell error="No image found. Please start from the upload step.">
        <Button variant="outline" onClick={() => router.push('/upload')}>
          Go to upload
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <DescriptionStream
        imageId={imageId}
        onDescriptionComplete={handleDescriptionComplete}
        disabled={false}
      />
    </PageShell>
  );
}

export default function DescribePage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <DescribeContent />
    </Suspense>
  );
}
