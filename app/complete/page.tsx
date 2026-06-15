'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageShell, RouteFallback } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Download, Images, RotateCcw } from 'lucide-react';

function CompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageUrl = searchParams.get('imageUrl');
  const imageId = searchParams.get('imageId');

  if (!imageUrl) {
    return (
      <PageShell error="No result image found. Please start from the upload step.">
        <Button variant="outline" onClick={() => router.push('/upload')}>
          Go to upload
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell wide={!!imageId}>
      <div className="space-y-5">
        {imageId ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="space-y-2">
              <div className="relative h-[60vh] w-full overflow-hidden rounded-lg border border-border bg-muted/20">
                <Image
                  src={`/api/images/${imageId}`}
                  alt="Original artwork"
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-contain"
                />
              </div>
              <figcaption className="text-center text-xs uppercase tracking-wider text-muted-foreground">
                Original
              </figcaption>
            </figure>
            <figure className="space-y-2">
              <div className="relative h-[60vh] w-full overflow-hidden rounded-lg border border-border bg-muted/20">
                <Image
                  src={imageUrl}
                  alt="Reinterpretation"
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-contain"
                />
              </div>
              <figcaption className="text-center text-xs uppercase tracking-wider text-muted-foreground">
                Reinterpretation
              </figcaption>
            </figure>
          </div>
        ) : (
          <div className="relative mx-auto h-[70vh] w-full overflow-hidden rounded-lg">
            <Image
              src={imageUrl}
              alt="Reinterpreted result"
              fill
              unoptimized
              sizes="100vw"
              className="object-contain"
            />
          </div>
        )}

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
