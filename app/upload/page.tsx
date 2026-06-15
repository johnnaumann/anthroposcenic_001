'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUploadZone } from '@/components/ImageUploadZone';
import { ContentCard, PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Images } from 'lucide-react';
import { UploadResponse } from '@/types';
import { clearPipelineState } from '@/lib/pipeline-storage';

export default function UploadPage() {
  const router = useRouter();

  useEffect(() => {
    clearPipelineState();
  }, []);

  const handleUploadComplete = (response: UploadResponse) => {
    router.push(`/describe?imageId=${response.imageId}`);
  };

  return (
    <PageShell>
      <ContentCard>
        <div className="space-y-6">
          <ImageUploadZone onUploadComplete={handleUploadComplete} />
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => router.push('/archive')}>
              <Images />
              Choose from archive
            </Button>
          </div>
        </div>
      </ContentCard>
    </PageShell>
  );
}
