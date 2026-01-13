'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to upload step
    router.push('/upload');
  }, [router]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Anthroposcenic</h1>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </main>
  );
}
