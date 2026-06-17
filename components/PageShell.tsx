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

/** Full-height centered block inside PageShell (loaders, empty states). */
export function PageCenter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-5rem)] flex-1 flex-col items-center justify-center text-center',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Centered loading state for use inside PageShell (no card). */
export function PageLoader({ label }: { label: string }) {
  return (
    <PageCenter className="gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      {label}
    </PageCenter>
  );
}

/**
 * The standard off-black content card. Compose it inside a PageShell around
 * content that should be framed; leave it off for loading or transient states.
 */
export function ContentCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('p-6 shadow-2xl shadow-black/40', className)}>{children}</Card>
  );
}

interface PageShellProps {
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}

/**
 * Shared page chrome: a theme toggle and a centered content column (width set by
 * `wide`). Pipeline steps (default) vertically center their content; wide layouts
 * (e.g. archive) stay top-aligned for scrollable grids.
 */
export function PageShell({ error, wide, children }: PageShellProps) {
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

      <main className="flex flex-1 flex-col items-center px-5 py-10">
        <div
          className={cn(
            'flex w-full flex-1 flex-col',
            wide ? 'max-w-5xl' : 'max-w-xl justify-center'
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
