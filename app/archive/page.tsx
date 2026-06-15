'use client';

import { useRouter } from 'next/navigation';
import { OutputArchiveGrid } from '@/components/OutputArchiveGrid';
import { PageShell } from '@/components/PageShell';

export default function ArchivePage() {
  const router = useRouter();

  return (
    <PageShell wide>
      <OutputArchiveGrid onBack={() => router.push('/upload')} />
    </PageShell>
  );
}
