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
import { HelpCircle, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { ComfyUIConfig } from '@/types';
import { cn } from '@/lib/utils';

interface ConfigSelectorProps {
  description: string;
  onConfigSelected: (config: ComfyUIConfig) => void;
  disabled?: boolean;
}

interface ComfyUIConfigOptions {
  checkpoints: string[];
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
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground/60 hover:text-muted-foreground"
            aria-label={`About ${label}`}
          >
            <HelpCircle />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
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
        'flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors',
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
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  );
}

export function ConfigSelector({ description, onConfigSelected, disabled }: ConfigSelectorProps) {
  const [configOptions, setConfigOptions] = useState<ComfyUIConfigOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [checkpoint, setCheckpoint] = useState('');
  const [sampler, setSampler] = useState('dpmpp_2m');
  const [scheduler, setScheduler] = useState('karras');
  const [steps, setSteps] = useState(32);
  const [cfgScale, setCfgScale] = useState(7);
  const [denoiseStrength, setDenoiseStrength] = useState(0.6);
  const [negativePrompt, setNegativePrompt] = useState(
    'blurry, lowres, low quality, worst quality, jpeg artifacts, compression artifacts, oversaturated, washed out, flat lighting, deformed, disfigured, mutated, extra limbs, bad anatomy, watermark, signature, text, cropped, out of frame, duplicate'
  );

  const [hiresFix, setHiresFix] = useState(true);
  const [hiresFactor, setHiresFactor] = useState(1.5);
  const [hiresDenoise, setHiresDenoise] = useState(0.45);
  const [controlNet, setControlNet] = useState(false);
  const [controlNetStrength, setControlNetStrength] = useState(0.65);
  const [freeU, setFreeU] = useState(true);
  const [qualityBoost, setQualityBoost] = useState(true);

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
          const dreamshaperIndex = data.checkpoints.findIndex((cp: string) => cp.includes('DreamShaper'));
          setCheckpoint(dreamshaperIndex >= 0 ? data.checkpoints[dreamshaperIndex] : data.checkpoints[0]);
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
    onConfigSelected({
      description,
      checkpoint,
      sampler,
      scheduler,
      steps,
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
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading configuration…
      </div>
    );
  }

  if (loadFailed || !configOptions) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <FieldLabel
          label="Model"
          tip="The base model that sets the artistic style and capabilities. Different checkpoints produce different looks."
        />
        <ConfigSelect
          value={checkpoint}
          onValueChange={setCheckpoint}
          options={configOptions.checkpoints}
          placeholder="Select model"
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <FieldLabel label="Sampler" tip="The sampling algorithm. dpmpp_2m gives crisp, detailed results." />
          <ConfigSelect
            value={sampler}
            onValueChange={setSampler}
            options={configOptions.samplers}
            placeholder="Select sampler"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel label="Scheduler" tip="Controls how noise is reduced. 'karras' favors fine detail." />
          <ConfigSelect
            value={scheduler}
            onValueChange={setScheduler}
            options={configOptions.schedulers}
            placeholder="Select scheduler"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <FieldLabel label="Steps" tip="Sampling iterations. More steps = more refinement, slower. 30–40 is a good range." />
          <Input
            type="number"
            value={steps}
            onChange={(e) => setSteps(parseInt(e.target.value, 10) || 32)}
            min={10}
            max={100}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel label="CFG" tip="Prompt adherence. Lower = more creative, higher = sticks to the prompt. 6–8 is balanced." />
          <Input
            type="number"
            value={cfgScale}
            onChange={(e) => setCfgScale(parseFloat(e.target.value) || 7)}
            min={1}
            max={20}
            step={0.1}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel label="Denoise" tip="How much the source image changes (img2img). 0.6 reinterprets boldly while keeping composition." />
          <Input
            type="number"
            value={denoiseStrength}
            onChange={(e) => setDenoiseStrength(parseFloat(e.target.value) || 0.6)}
            min={0}
            max={1}
            step={0.05}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel label="Negative prompt" tip="Things to avoid. Pre-filled to suppress common artifacts and mush." />
        <Textarea
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          disabled={disabled}
          className="min-h-[88px] text-[13px] leading-relaxed"
          placeholder="blurry, low quality, artifacts…"
        />
      </div>

      <div className="space-y-3 border-t border-border pt-5">
        <FieldLabel
          label="Detail & refinement"
          tip="Post-processing that sharpens texture and adds fine detail. Tuned for your GPU — switch off for faster, lighter runs."
        />
        <div className="grid grid-cols-2 gap-2">
          <ConfigToggle id="hiresFix" label="Hi-res detail pass" checked={hiresFix} onChange={setHiresFix} disabled={disabled} />
          <ConfigToggle id="controlNet" label="ControlNet Tile" checked={controlNet} onChange={setControlNet} disabled={disabled || !hiresFix} />
          <ConfigToggle id="freeU" label="FreeU boost" checked={freeU} onChange={setFreeU} disabled={disabled} />
          <ConfigToggle id="qualityBoost" label="Quality tags" checked={qualityBoost} onChange={setQualityBoost} disabled={disabled} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <FieldLabel label="Upscale ×" tip="Final size vs the base image. 2.0 ≈ 2560px from a 1280px base. Higher = sharper and slower." />
            <Input
              type="number"
              value={hiresFactor}
              onChange={(e) => setHiresFactor(parseFloat(e.target.value) || 1.5)}
              min={1}
              max={4}
              step={0.25}
              disabled={disabled || !hiresFix}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel label="Refine denoise" tip="How much texture the refine pass redraws. Higher = more detail/change; lower = more faithful. 0.5–0.6 is a good range." />
            <Input
              type="number"
              value={hiresDenoise}
              onChange={(e) => setHiresDenoise(parseFloat(e.target.value) || 0.45)}
              min={0}
              max={1}
              step={0.05}
              disabled={disabled || !hiresFix}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel label="Tile strength" tip="How strongly ControlNet Tile holds the original structure during refine. Higher = more faithful." />
            <Input
              type="number"
              value={controlNetStrength}
              onChange={(e) => setControlNetStrength(parseFloat(e.target.value) || 0.65)}
              min={0}
              max={2}
              step={0.05}
              disabled={disabled || !hiresFix || !controlNet}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="truncate text-xs text-muted-foreground">
          {checkpoint} · {steps} steps · denoise {denoiseStrength}
          {hiresFix ? ` · hi-res ×${hiresFactor}${controlNet ? ' + tile' : ''}` : ' · no hi-res'}
        </p>
        <Button
          size="lg"
          onClick={handleProcess}
          disabled={disabled || !checkpoint || !sampler || !description.trim()}
        >
          Continue
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
