'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Download, RotateCcw } from 'lucide-react';

function CompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageUrl = searchParams.get('imageUrl');

  if (!imageUrl) {
    return (
      <PageShell step="complete" error="No result image found. Please start from the upload step.">
        <Button variant="outline" onClick={() => router.push('/upload')}>
          Go to upload
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell step="complete">
      <div className="space-y-5">
        <div className="overflow-hidden rounded-lg">
          <img
            src={imageUrl}
            alt="Reinterpreted result"
            className="mx-auto max-h-[70vh] w-full object-contain"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => router.push('/upload')}>
            <RotateCcw />
            Reinterpret another
          </Button>
          <Button variant="outline" onClick={() => window.open(imageUrl, '_blank')}>
            <Download />
            Open full size
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <CompleteContent />
    </Suspense>
  );
}
