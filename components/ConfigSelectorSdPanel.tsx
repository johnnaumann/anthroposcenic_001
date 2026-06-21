'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ComfyUIConfigOptions } from '@/types';
import { ConfigFormValues } from '@/lib/config-form';
import { cn } from '@/lib/utils';
import {
  ConfigSelect,
  ConfigToggle,
  FieldLabel,
} from '@/components/ConfigSelectorFields';

interface ConfigSelectorSdPanelProps {
  configOptions: ComfyUIConfigOptions;
  values: ConfigFormValues;
  onFieldChange: <K extends keyof ConfigFormValues>(key: K, value: ConfigFormValues[K]) => void;
  disabled?: boolean;
}

export function ConfigSelectorSdPanel({
  configOptions,
  values,
  onFieldChange,
  disabled,
}: ConfigSelectorSdPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel label="Sampler" tip="The sampling algorithm. dpmpp_2m gives crisp, detailed results." />
          <ConfigSelect
            value={values.sampler}
            onValueChange={(value) => onFieldChange('sampler', value)}
            options={configOptions.samplers}
            placeholder="Sampler"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel label="Scheduler" tip="Controls how noise is reduced. 'karras' favors fine detail." />
          <ConfigSelect
            value={values.scheduler}
            onValueChange={(value) => onFieldChange('scheduler', value)}
            options={configOptions.schedulers}
            placeholder="Scheduler"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <FieldLabel label="Steps" tip="Sampling iterations. 30–40 is a good range; more = slower." />
          <Input
            type="number"
            value={values.steps}
            onChange={(e) => onFieldChange('steps', parseInt(e.target.value, 10) || 28)}
            min={10}
            max={100}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel label="CFG" tip="Prompt adherence. 6–8 is balanced; lower = more creative." />
          <Input
            type="number"
            value={values.cfgScale}
            onChange={(e) => onFieldChange('cfgScale', parseFloat(e.target.value) || 7)}
            min={1}
            max={20}
            step={0.1}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel
            label="Denoise"
            tip="How much the source changes (img2img). 0.85 reinterprets boldly; lower stays closer."
          />
          <Input
            type="number"
            value={values.denoiseStrength}
            onChange={(e) => onFieldChange('denoiseStrength', parseFloat(e.target.value) || 0.85)}
            min={0}
            max={1}
            step={0.05}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-90')} />
          Advanced
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <FieldLabel
                label="Negative prompt"
                tip="Things to avoid. Pre-filled to suppress faces, people, animals and common artifacts."
              />
              <Textarea
                value={values.negativePrompt}
                onChange={(e) => onFieldChange('negativePrompt', e.target.value)}
                disabled={disabled}
                className="min-h-[64px] resize-none text-sm leading-relaxed"
                placeholder="blurry, low quality…"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ConfigToggle
                id="hiresFix"
                label="Hi-res pass"
                checked={values.hiresFix ?? false}
                onChange={(value) => onFieldChange('hiresFix', value)}
                disabled={disabled}
              />
              <ConfigToggle
                id="controlNet"
                label="ControlNet Tile"
                checked={values.controlNet ?? false}
                onChange={(value) => onFieldChange('controlNet', value)}
                disabled={disabled || !(values.hiresFix ?? false)}
              />
              <ConfigToggle
                id="freeU"
                label="FreeU"
                checked={values.freeU ?? false}
                onChange={(value) => onFieldChange('freeU', value)}
                disabled={disabled}
              />
              <ConfigToggle
                id="qualityBoost"
                label="Quality tags"
                checked={values.qualityBoost ?? false}
                onChange={(value) => onFieldChange('qualityBoost', value)}
                disabled={disabled}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <FieldLabel label="Upscale ×" tip="Final size vs the base. Higher = sharper and slower." />
                <Input
                  type="number"
                  value={values.hiresFactor}
                  onChange={(e) => onFieldChange('hiresFactor', parseFloat(e.target.value) || 1.5)}
                  min={1}
                  max={4}
                  step={0.25}
                  disabled={disabled || !(values.hiresFix ?? false)}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel label="Refine" tip="How much texture the refine pass redraws. 0.4–0.6 is good." />
                <Input
                  type="number"
                  value={values.hiresDenoise}
                  onChange={(e) => onFieldChange('hiresDenoise', parseFloat(e.target.value) || 0.45)}
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={disabled || !(values.hiresFix ?? false)}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel
                  label="Tile"
                  tip="How strongly ControlNet Tile holds structure. Higher = more faithful."
                />
                <Input
                  type="number"
                  value={values.controlNetStrength}
                  onChange={(e) =>
                    onFieldChange('controlNetStrength', parseFloat(e.target.value) || 0.65)
                  }
                  min={0}
                  max={2}
                  step={0.05}
                  disabled={
                    disabled || !(values.hiresFix ?? false) || !(values.controlNet ?? false)
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
