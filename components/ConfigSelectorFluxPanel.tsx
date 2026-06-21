'use client';

import { ComfyUIConfigOptions } from '@/types';
import { ConfigFormValues, FluxQuality } from '@/lib/config-form';
import { cn } from '@/lib/utils';
import { FieldLabel, NumberField } from '@/components/ConfigSelectorFields';

interface ConfigSelectorFluxPanelProps {
  configOptions: ComfyUIConfigOptions;
  values: ConfigFormValues;
  onFluxQualityChange: (quality: FluxQuality) => void;
  onDenoiseChange: (value: number) => void;
  disabled?: boolean;
}

export function ConfigSelectorFluxPanel({
  configOptions,
  values,
  onFluxQualityChange,
  onDenoiseChange,
  disabled,
}: ConfigSelectorFluxPanelProps) {
  return (
    <>
      <div className="space-y-1.5">
        <FieldLabel
          label="Speed"
          tip="Fast ≈ 2 min — great for exploring. Slow ≈ 13 min — for final pieces. Flux uses its own engine, so the SD knobs (sampler, CFG, scheduler, hi-res, negative prompt) don't apply."
        />
        <div className="flex gap-1 rounded-lg border border-border p-1">
          <button
            type="button"
            disabled={disabled || !configOptions.flux?.schnell}
            onClick={() => onFluxQualityChange('fast')}
            className={cn(
              'flex-1 rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-40',
              values.fluxQuality === 'fast'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Fast
          </button>
          <button
            type="button"
            disabled={disabled || !configOptions.flux?.dev}
            onClick={() => onFluxQualityChange('quality')}
            className={cn(
              'flex-1 rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-40',
              values.fluxQuality === 'quality'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Slow
          </button>
        </div>
      </div>

      <NumberField
        label="Denoise"
        tip="How boldly Flux riffs on the source. 0.85 = strong reinterpretation; lower stays closer to the original."
        value={values.denoiseStrength}
        onChange={(value) => onDenoiseChange(Number.isFinite(value) ? value : 0.85)}
        min={0}
        max={1}
        step={0.05}
        disabled={disabled}
      />
    </>
  );
}
