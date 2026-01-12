'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Circle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineStatusProps {
  step: 'upload' | 'describe' | 'process' | 'complete';
  error?: string;
}

const steps = [
  { id: 'upload', label: 'Upload Image' },
  { id: 'describe', label: 'Generate Description' },
  { id: 'process', label: 'Process with ComfyUI' },
  { id: 'complete', label: 'Complete' },
] as const;

export function PipelineStatus({ step, error }: PipelineStatusProps) {
  const getStepIndex = (currentStep: string) => {
    return steps.findIndex(s => s.id === currentStep);
  };

  const currentIndex = getStepIndex(step);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {steps.map((stepItem, index) => {
            const isActive = index === currentIndex;
            const isComplete = index < currentIndex;
            const isError = error && index === currentIndex;

            return (
              <div key={stepItem.id} className="flex items-center gap-4">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2",
                  isComplete && "bg-primary border-primary text-primary-foreground",
                  isActive && !isError && "border-primary text-primary",
                  isError && "border-destructive text-destructive",
                  !isActive && !isComplete && "border-muted text-muted-foreground"
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isError ? (
                    <XCircle className="h-5 w-5" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <div className={cn(
                    "text-sm font-medium",
                    isActive && "text-foreground",
                    !isActive && "text-muted-foreground"
                  )}>
                    {stepItem.label}
                  </div>
                  {isError && error && (
                    <div className="text-xs text-destructive mt-1">{error}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
