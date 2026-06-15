'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ContentCard, PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Download, Images, RotateCcw } from 'lucide-react';

function CompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageUrl = searchParams.get('imageUrl');

  if (!imageUrl) {
    return (
      <PageShell error="No result image found. Please start from the upload step.">
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
      <ContentCard>
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-sm font-medium">Processing complete</p>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
              Your reinterpretation is ready. Download it or browse past results in the archive.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => router.push('/upload')}>
              <RotateCcw />
              Reinterpret another
            </Button>
            <Button variant="outline" asChild>
              <a href={imageUrl} download="anthroposcenic.png">
                <Download />
                Download
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/archive">
                <Images />
                Archive
              </Link>
            </Button>
          </div>
        </div>
      </ContentCard>
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
