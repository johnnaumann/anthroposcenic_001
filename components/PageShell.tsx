'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card } from '@/components/ui/card';

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
  children: React.ReactNode;
}

/**
 * Shared chrome: a theme toggle and the step's content in an off-black card
 * centered on the near-black page.
 */
export function PageShell({ error, children }: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="fixed right-5 top-5 z-20">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 px-5 py-10">
        <div className="m-auto w-full max-w-xl">
          <Card className="p-6 shadow-2xl shadow-black/40">
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{error}</span>
              </div>
            )}
            {children}
          </Card>
        </div>
      </main>
    </div>
  );
}
