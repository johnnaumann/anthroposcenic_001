'use client';

import { useRouter } from 'next/navigation';
import { ImageUploadZone } from '@/components/ImageUploadZone';
import { PageShell } from '@/components/PageShell';
import { UploadResponse } from '@/types';

export default function UploadPage() {
  const router = useRouter();

  const handleUploadComplete = (response: UploadResponse) => {
    router.push(`/describe?imageId=${response.imageId}`);
  };

  return (
    <PageShell>
      <ImageUploadZone onUploadComplete={handleUploadComplete} />
    </PageShell>
  );
}
