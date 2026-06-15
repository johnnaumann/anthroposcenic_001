'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OutputArchiveGrid } from '@/components/OutputArchiveGrid';
import { PageShell } from '@/components/PageShell';

export default function ArchivePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  return (
    <PageShell wide card={!loading}>
      <OutputArchiveGrid
        onLoadingChange={setLoading}
        onBack={() => router.push('/upload')}
      />
    </PageShell>
  );
}
