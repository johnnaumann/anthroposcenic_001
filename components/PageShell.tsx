'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Minimal centered loader for route-level <Suspense> fallbacks. */
export function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );
}

interface PageShellProps {
  error?: string;
  wide?: boolean;
  card?: boolean;
  children: React.ReactNode;
}

/**
 * Shared chrome: a theme toggle and the step's content in an off-black card
 * centered on the near-black page.
 */
export function PageShell({ error, wide, card = true, children }: PageShellProps) {
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="fixed right-5 top-5 z-20">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 flex-col px-5 py-10">
        <div
          className={cn(
            'm-auto w-full',
            wide ? 'max-w-5xl' : 'max-w-xl',
            !card && 'flex flex-1 flex-col items-center justify-center'
          )}
        >
          {card ? (
            <Card className="p-6 shadow-2xl shadow-black/40">{children}</Card>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
