'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DescriptionStream } from '@/components/DescriptionStream';
import { ContentCard, PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { savePipelineDescription, clearPipelineConfig } from '@/lib/pipeline-storage';

function DescribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get('imageId');
  const imageIdsParam = searchParams.get('imageIds');
  const imageIds = imageIdsParam ? imageIdsParam.split(',').filter(Boolean) : null;
  const isBlend = !!imageIds && imageIds.length > 0;
  const hasSource = isBlend || !!imageId;

  useEffect(() => {
    if (hasSource) {
      clearPipelineConfig();
    }
  }, [hasSource]);

  const handleDescriptionComplete = (description: string) => {
    savePipelineDescription(description);
    router.push(isBlend ? '/configure?mode=blend' : `/configure?imageId=${imageId}`);
  };

  if (!hasSource) {
    return (
      <PageShell error="No image found. Please start from the upload step.">
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
      <DescriptionStream
        imageId={imageId}
        imageIds={imageIds}
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
