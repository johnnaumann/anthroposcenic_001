'use client';

import { cn } from '@/lib/utils';

export const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'describe', label: 'Describe' },
  { id: 'edit', label: 'Edit' },
  { id: 'configure', label: 'Configure' },
  { id: 'process', label: 'Process' },
  { id: 'complete', label: 'Complete' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export function stepIndex(step: StepId) {
  return STEPS.findIndex((s) => s.id === step);
}

/** Slim, monochrome progress indicator: filled dots + connecting line. */
export function Stepper({ current }: { current: StepId }) {
  const currentIndex = stepIndex(current);

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const isComplete = i < currentIndex;
          const isActive = i === currentIndex;
          const isLast = i === STEPS.length - 1;

          return (
            <li
              key={step.id}
              className={cn('flex items-center', !isLast && 'flex-1')}
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full border transition-colors',
                  isComplete && 'border-foreground bg-foreground',
                  isActive && 'border-foreground bg-foreground ring-4 ring-foreground/15',
                  !isComplete && !isActive && 'border-border bg-transparent'
                )}
              />
              {!isLast && (
                <span
                  className={cn(
                    'mx-2 h-px flex-1 transition-colors',
                    isComplete ? 'bg-foreground' : 'bg-border'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
