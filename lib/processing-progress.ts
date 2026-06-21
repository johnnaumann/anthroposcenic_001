import { ComfyUIConfig } from '@/types';

export interface ProcessingPhase {
  id: string;
  label: string;
  weight: number;
}

interface ProcessingProgressSnapshot {
  overall: number;
  phaseLabel: string;
  phaseIndex: number;
  phaseCount: number;
  stepProgress: number;
  step?: number;
  stepMax?: number;
}

export function getSamplingPhases(config: Pick<ComfyUIConfig, 'hiresFix'>): ProcessingPhase[] {
  const useHires = config.hiresFix !== false;
  if (!useHires) {
    return [{ id: 'base', label: 'Generating image', weight: 1 }];
  }

  return [
    { id: 'base', label: 'Base generation', weight: 0.45 },
    { id: 'hires', label: 'Upscaling and refining detail', weight: 0.55 },
  ];
}

export function createProgressAggregator(phases: ProcessingPhase[]) {
  let phaseIndex = 0;
  let lastStepProgress = 0;

  const update = (
    stepProgress: number,
    step?: number,
    stepMax?: number
  ): ProcessingProgressSnapshot => {
    const clampedStep = Math.max(0, Math.min(100, stepProgress));

    // ComfyUI reports 0-100% per KSampler pass; a sharp drop means the next phase started.
    if (
      phaseIndex < phases.length - 1 &&
      lastStepProgress >= 85 &&
      clampedStep <= 15
    ) {
      phaseIndex += 1;
    }

    lastStepProgress = clampedStep;

    const completedWeight = phases
      .slice(0, phaseIndex)
      .reduce((sum, phase) => sum + phase.weight, 0);
    const currentPhase = phases[phaseIndex];
    const phaseFraction = (clampedStep / 100) * currentPhase.weight;
    const overall = Math.min(
      99,
      Math.max(
        clampedStep > 0 ? 1 : 0,
        Math.round((completedWeight + phaseFraction) * 100)
      )
    );

    return {
      overall,
      phaseLabel: currentPhase.label,
      phaseIndex: phaseIndex + 1,
      phaseCount: phases.length,
      stepProgress: clampedStep,
      step,
      stepMax,
    };
  };

  const complete = (): ProcessingProgressSnapshot => {
    const lastPhase = phases[phases.length - 1];
    return {
      overall: 100,
      phaseLabel: lastPhase.label,
      phaseIndex: phases.length,
      phaseCount: phases.length,
      stepProgress: 100,
    };
  };

  return { update, complete };
}
