'use client';

import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Stepper, STEPS, stepIndex, type StepId } from '@/components/Stepper';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  /** Heading for the step. Defaults to the step's label. */
  title?: string;
  subtitle?: string;
  error?: string;
  children: React.ReactNode;
}

/**
 * Shared chrome for every route: wordmark + theme toggle header, a slim stepper,
 * a step heading, and a focused single-column content area.
 */
export function PageShell({ step, title, subtitle, error, children }: PageShellProps) {
  const index = stepIndex(step);
  const heading = title ?? STEPS[index]?.label ?? '';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-5">
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <Stepper current={step} />

        <div className="mt-8 space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Step {index + 1} / {STEPS.length}
          </p>
          <h1 className="text-2xl font-medium tracking-tight">{heading}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">{error}</span>
          </div>
        )}

        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
