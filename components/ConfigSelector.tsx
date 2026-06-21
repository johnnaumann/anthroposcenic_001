'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { ContentCard, PageLoader } from '@/components/PageShell';
import { ConfigSelectorFluxPanel } from '@/components/ConfigSelectorFluxPanel';
import { ConfigSelectorSdPanel } from '@/components/ConfigSelectorSdPanel';
import { ConfigSelect, FieldLabel } from '@/components/ConfigSelectorFields';
import { ComfyUIConfig } from '@/types';
import { buildProcessConfig, formatConfigSummary, isFluxCheckpoint } from '@/lib/config-selector';
import { useConfigSelectorForm } from '@/lib/use-config-selector-form';

interface ConfigSelectorProps {
  description: string;
  onConfigSelected: (config: ComfyUIConfig) => void;
  disabled?: boolean;
}

export function ConfigSelector({ description, onConfigSelected, disabled }: ConfigSelectorProps) {
  const { configOptions, loading, loadFailed, values, setField } = useConfigSelectorForm();

  const handleProcess = () => {
    const result = buildProcessConfig(description, values, configOptions);
    if ('error' in result) {
      if (result.error !== 'Missing required configuration') {
        toast.error(result.error);
      }
      return;
    }

    onConfigSelected(result.config);
  };

  if (loading) {
    return <PageLoader label="Loading configuration…" />;
  }

  if (loadFailed || !configOptions) {
    return null;
  }

  const isFlux = isFluxCheckpoint(values.checkpoint);

  return (
    <ContentCard className="space-y-4">
      <div className="space-y-1.5">
        <FieldLabel
          label="Model"
          tip="The engine. Flux gives the most painterly reinterpretations; the SD models are faster, lighter alternatives."
        />
        <ConfigSelect
          value={values.checkpoint}
          onValueChange={(value) => setField('checkpoint', value)}
          options={configOptions.checkpoints}
          placeholder="Select model"
          disabled={disabled}
        />
      </div>

      {isFlux ? (
        <ConfigSelectorFluxPanel
          configOptions={configOptions}
          values={values}
          onFluxQualityChange={(quality) => setField('fluxQuality', quality)}
          onDenoiseChange={(value) => setField('denoiseStrength', value)}
          disabled={disabled}
        />
      ) : (
        <ConfigSelectorSdPanel
          configOptions={configOptions}
          values={values}
          onFieldChange={setField}
          disabled={disabled}
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="truncate text-xs text-muted-foreground">{formatConfigSummary(values)}</p>
        <Button
          onClick={handleProcess}
          disabled={disabled || !values.checkpoint || !values.sampler || !description.trim()}
        >
          Continue
          <ArrowRight />
        </Button>
      </div>
    </ContentCard>
  );
}
