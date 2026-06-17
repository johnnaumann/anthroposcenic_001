'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Loader2, ArrowRight, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { ContentCard, PageLoader } from '@/components/PageShell';
import { ComfyUIConfig } from '@/types';
import { DEFAULT_NEGATIVE_PROMPT } from '@/lib/comfyui-defaults';
import { cn } from '@/lib/utils';

interface ConfigSelectorProps {
  description: string;
  onConfigSelected: (config: ComfyUIConfig) => void;
  disabled?: boolean;
}

interface ComfyUIConfigOptions {
  checkpoints: string[];
  flux?: { schnell: string | null; dev: string | null };
  samplers: string[];
  schedulers: string[];
  defaults: {
    sampler?: string;
    scheduler?: string;
    steps: number;
    cfgScale: number;
    denoiseStrength: number;
    negativePrompt: string;
    hiresFix?: boolean;
    hiresFactor?: number;
    hiresDenoise?: number;
    controlNet?: boolean;
    controlNetStrength?: number;
    freeU?: boolean;
    qualityBoost?: boolean;
  };
}

function FieldLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
            aria-label={`About ${label}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function ConfigSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ConfigToggle({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 transition-colors',
        checked ? 'bg-accent/40' : 'hover:bg-accent/20',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        disabled={disabled}
      />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}

/** Compact horizontal number field: tooltip label on the left, small input on the right. */
function NumberField({
  label,
  tip,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  tip: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <FieldLabel label={label} tip={tip} />
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-24"
      />
    </div>
  );
}

export function ConfigSelector({ description, onConfigSelected, disabled }: ConfigSelectorProps) {
  const [configOptions, setConfigOptions] = useState<ComfyUIConfigOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [checkpoint, setCheckpoint] = useState('');
  const [sampler, setSampler] = useState('dpmpp_2m');
  const [scheduler, setScheduler] = useState('karras');
  const [steps, setSteps] = useState(28);
  const [cfgScale, setCfgScale] = useState(7);
  const [denoiseStrength, setDenoiseStrength] = useState(0.85);
  const [negativePrompt, setNegativePrompt] = useState(DEFAULT_NEGATIVE_PROMPT);

  const [hiresFix, setHiresFix] = useState(true);
  const [hiresFactor, setHiresFactor] = useState(1.5);
  const [hiresDenoise, setHiresDenoise] = useState(0.45);
  const [controlNet, setControlNet] = useState(false);
  const [controlNetStrength, setControlNetStrength] = useState(0.65);
  const [freeU, setFreeU] = useState(true);
  const [qualityBoost, setQualityBoost] = useState(true);
  // Flux speed/quality: 'fast' = schnell (4 steps), 'quality' = dev (20 steps).
  const [fluxQuality, setFluxQuality] = useState<'fast' | 'quality'>('fast');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/comfyui/config');
        if (!response.ok) {
          throw new Error('Failed to fetch configuration options');
        }
        const data = await response.json();
        setConfigOptions(data);

        if (data.checkpoints.length > 0) {
          // Prefer Flux (best artistic reinterpretation), then DreamShaper, else first.
          const flux = data.checkpoints.find((cp: string) => /flux|\.gguf$/i.test(cp));
          const dream = data.checkpoints.find((cp: string) => cp.includes('DreamShaper'));
          setCheckpoint(flux || dream || data.checkpoints[0]);
        }
        if (data.samplers.length > 0) {
          const preferredSampler = data.defaults?.sampler || 'dpmpp_2m';
          setSampler(data.samplers.includes(preferredSampler) ? preferredSampler : data.samplers[0]);
        }
        const preferredScheduler = data.defaults?.scheduler || 'karras';
        setScheduler(
          data.schedulers?.includes(preferredScheduler) ? preferredScheduler : data.schedulers?.[0] || 'normal'
        );
        setSteps(data.defaults.steps);
        setCfgScale(data.defaults.cfgScale);
        setDenoiseStrength(data.defaults.denoiseStrength);
        setNegativePrompt(data.defaults.negativePrompt);

        const d = data.defaults || {};
        if (typeof d.hiresFix === 'boolean') setHiresFix(d.hiresFix);
        if (typeof d.hiresFactor === 'number') setHiresFactor(d.hiresFactor);
        if (typeof d.hiresDenoise === 'number') setHiresDenoise(d.hiresDenoise);
        if (typeof d.controlNet === 'boolean') setControlNet(d.controlNet);
        if (typeof d.controlNetStrength === 'number') setControlNetStrength(d.controlNetStrength);
        if (typeof d.freeU === 'boolean') setFreeU(d.freeU);
        if (typeof d.qualityBoost === 'boolean') setQualityBoost(d.qualityBoost);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load configuration';
        toast.error(message);
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleProcess = () => {
    if (!checkpoint || !sampler || !description.trim()) {
      return;
    }
    // Resolve the single "Flux" option to the real GGUF + step count via the speed toggle.
    let finalCheckpoint = checkpoint;
    let finalSteps = steps;
    if (checkpoint === 'Flux') {
      const f = configOptions?.flux;
      const chosen = fluxQuality === 'fast' ? f?.schnell || f?.dev : f?.dev || f?.schnell;
      if (!chosen) {
        toast.error('No Flux model is installed.');
        return;
      }
      finalCheckpoint = chosen;
      finalSteps = fluxQuality === 'fast' ? 4 : 20;
    }
    onConfigSelected({
      description,
      checkpoint: finalCheckpoint,
      sampler,
      scheduler,
      steps: finalSteps,
      cfgScale,
      denoiseStrength,
      negativePrompt,
      hiresFix,
      hiresFactor,
      hiresDenoise,
      controlNet,
      controlNetStrength,
      freeU,
      qualityBoost,
    });
  };

  if (loading) {
    return <PageLoader label="Loading configuration…" />;
  }

  if (loadFailed || !configOptions) {
    return null;
  }

  const isFlux = /flux|\.gguf$/i.test(checkpoint);
  const summary = isFlux
    ? `Flux · ${fluxQuality === 'fast' ? 'fast · ~2 min' : 'slow · ~13 min'} · denoise ${denoiseStrength}`
    : `${checkpoint} · ${steps} steps · denoise ${denoiseStrength}${hiresFix ? ' · hi-res' : ''}`;

  return (
    <ContentCard className="space-y-4">
      <div className="space-y-1.5">
        <FieldLabel
          label="Model"
          tip="The engine. Flux gives the most painterly reinterpretations; the SD models are faster, lighter alternatives."
        />
        <ConfigSelect
          value={checkpoint}
          onValueChange={setCheckpoint}
          options={configOptions.checkpoints}
          placeholder="Select model"
          disabled={disabled}
        />
      </div>

      {isFlux ? (
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
                onClick={() => setFluxQuality('fast')}
                className={cn(
                  'flex-1 rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-40',
                  fluxQuality === 'fast' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Fast
              </button>
              <button
                type="button"
                disabled={disabled || !configOptions.flux?.dev}
                onClick={() => setFluxQuality('quality')}
                className={cn(
                  'flex-1 rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-40',
                  fluxQuality === 'quality' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Slow
              </button>
            </div>
          </div>

          <NumberField
            label="Denoise"
            tip="How boldly Flux riffs on the source. 0.85 = strong reinterpretation; lower stays closer to the original."
            value={denoiseStrength}
            onChange={(v) => setDenoiseStrength(Number.isFinite(v) ? v : 0.85)}
            min={0}
            max={1}
            step={0.05}
            disabled={disabled}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel label="Sampler" tip="The sampling algorithm. dpmpp_2m gives crisp, detailed results." />
              <ConfigSelect value={sampler} onValueChange={setSampler} options={configOptions.samplers} placeholder="Sampler" disabled={disabled} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Scheduler" tip="Controls how noise is reduced. 'karras' favors fine detail." />
              <ConfigSelect value={scheduler} onValueChange={setScheduler} options={configOptions.schedulers} placeholder="Scheduler" disabled={disabled} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <FieldLabel label="Steps" tip="Sampling iterations. 30–40 is a good range; more = slower." />
              <Input type="number" value={steps} onChange={(e) => setSteps(parseInt(e.target.value, 10) || 28)} min={10} max={100} disabled={disabled} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="CFG" tip="Prompt adherence. 6–8 is balanced; lower = more creative." />
              <Input type="number" value={cfgScale} onChange={(e) => setCfgScale(parseFloat(e.target.value) || 7)} min={1} max={20} step={0.1} disabled={disabled} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Denoise" tip="How much the source changes (img2img). 0.85 reinterprets boldly; lower stays closer." />
              <Input type="number" value={denoiseStrength} onChange={(e) => setDenoiseStrength(parseFloat(e.target.value) || 0.85)} min={0} max={1} step={0.05} disabled={disabled} />
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-90')} />
              Advanced
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <FieldLabel label="Negative prompt" tip="Things to avoid. Pre-filled to suppress faces, people, animals and common artifacts." />
                  <Textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    disabled={disabled}
                    className="min-h-[64px] resize-none text-sm leading-relaxed"
                    placeholder="blurry, low quality…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ConfigToggle id="hiresFix" label="Hi-res pass" checked={hiresFix} onChange={setHiresFix} disabled={disabled} />
                  <ConfigToggle id="controlNet" label="ControlNet Tile" checked={controlNet} onChange={setControlNet} disabled={disabled || !hiresFix} />
                  <ConfigToggle id="freeU" label="FreeU" checked={freeU} onChange={setFreeU} disabled={disabled} />
                  <ConfigToggle id="qualityBoost" label="Quality tags" checked={qualityBoost} onChange={setQualityBoost} disabled={disabled} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel label="Upscale ×" tip="Final size vs the base. Higher = sharper and slower." />
                    <Input type="number" value={hiresFactor} onChange={(e) => setHiresFactor(parseFloat(e.target.value) || 1.5)} min={1} max={4} step={0.25} disabled={disabled || !hiresFix} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel label="Refine" tip="How much texture the refine pass redraws. 0.4–0.6 is good." />
                    <Input type="number" value={hiresDenoise} onChange={(e) => setHiresDenoise(parseFloat(e.target.value) || 0.45)} min={0} max={1} step={0.05} disabled={disabled || !hiresFix} />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel label="Tile" tip="How strongly ControlNet Tile holds structure. Higher = more faithful." />
                    <Input type="number" value={controlNetStrength} onChange={(e) => setControlNetStrength(parseFloat(e.target.value) || 0.65)} min={0} max={2} step={0.05} disabled={disabled || !hiresFix || !controlNet} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="truncate text-xs text-muted-foreground">{summary}</p>
        <Button onClick={handleProcess} disabled={disabled || !checkpoint || !sampler || !description.trim()}>
          Continue
          <ArrowRight />
        </Button>
      </div>
    </ContentCard>
  );
}
