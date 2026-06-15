'use client';

import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Stepper, type StepId } from '@/components/Stepper';
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
  step: StepId;
  error?: string;
  children: React.ReactNode;
}

/**
 * Shared chrome: a slim wordmark/theme-toggle bar, a dot progress indicator, and
 * the step's content in an off-black card centered on the near-black page. No
 * titles or step labels — the content, placeholders and buttons speak for themselves.
 */
export function PageShell({ step, error, children }: PageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between px-5">
          <Link
            href="/upload"
            className="flex items-center gap-2 text-sm font-medium tracking-tight transition-opacity hover:opacity-70"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
            Anthroposcenic
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 px-5 py-10">
        <div className="m-auto w-full max-w-xl">
          <Stepper current={step} />
          <Card className="mt-6 p-6 shadow-2xl shadow-black/40">
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
