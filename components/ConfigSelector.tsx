'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { HelpCircle, Loader2, ArrowRight } from 'lucide-react';
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

const fieldClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50';

function FieldLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <Tooltip content={tip}>
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
      </Tooltip>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors',
        checked ? 'bg-accent/40' : 'hover:bg-accent/20',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 accent-[hsl(var(--foreground))]"
      />
      {label}
    </label>
  );
}

export function ConfigSelector({ description, onConfigSelected, disabled }: ConfigSelectorProps) {
  const [configOptions, setConfigOptions] = useState<ComfyUIConfigOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [checkpoint, setCheckpoint] = useState('');
  const [sampler, setSampler] = useState('dpmpp_2m');
  const [scheduler, setScheduler] = useState('karras');
  const [steps, setSteps] = useState(32);
  const [cfgScale, setCfgScale] = useState(7);
  const [denoiseStrength, setDenoiseStrength] = useState(0.6);
  const [negativePrompt, setNegativePrompt] = useState(
    'blurry, lowres, low quality, worst quality, jpeg artifacts, compression artifacts, oversaturated, washed out, flat lighting, deformed, disfigured, mutated, extra limbs, bad anatomy, watermark, signature, text, cropped, out of frame, duplicate'
  );

  // Detail & refinement
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

        // Prioritize DreamShaper if available, else first checkpoint
        if (data.checkpoints.length > 0) {
          const dreamshaperIndex = data.checkpoints.findIndex((cp: string) => cp.includes('DreamShaper'));
          setCheckpoint(dreamshaperIndex >= 0 ? data.checkpoints[dreamshaperIndex] : data.checkpoints[0]);
        }
        // Sampler: prefer dpmpp_2m (crisper detail), fall back gracefully
        if (data.samplers.length > 0) {
          const preferredSampler = data.defaults?.sampler || 'dpmpp_2m';
          setSampler(data.samplers.includes(preferredSampler) ? preferredSampler : data.samplers[0]);
        }
        // Scheduler: prefer karras for higher-quality detail
        const preferredScheduler = data.defaults?.scheduler || 'karras';
        setScheduler(
          data.schedulers?.includes(preferredScheduler) ? preferredScheduler : data.schedulers?.[0] || 'normal'
        );
        setSteps(data.defaults.steps);
        setCfgScale(data.defaults.cfgScale);
        setDenoiseStrength(data.defaults.denoiseStrength);
        setNegativePrompt(data.defaults.negativePrompt);

        // Detail & refinement defaults (tolerate an older server without them)
        const d = data.defaults || {};
        if (typeof d.hiresFix === 'boolean') setHiresFix(d.hiresFix);
        if (typeof d.hiresFactor === 'number') setHiresFactor(d.hiresFactor);
        if (typeof d.hiresDenoise === 'number') setHiresDenoise(d.hiresDenoise);
        if (typeof d.controlNet === 'boolean') setControlNet(d.controlNet);
        if (typeof d.controlNetStrength === 'number') setControlNetStrength(d.controlNetStrength);
        if (typeof d.freeU === 'boolean') setFreeU(d.freeU);
        if (typeof d.qualityBoost === 'boolean') setQualityBoost(d.qualityBoost);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
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

  if (error || !configOptions) {
    return <p className="py-8 text-sm text-muted-foreground">{error || 'No configuration available.'}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Model */}
      <div className="space-y-2">
        <FieldLabel
          label="Model"
          tip="The base model that sets the artistic style and capabilities. Different checkpoints produce different looks."
        />
        <select
          value={checkpoint}
          onChange={(e) => setCheckpoint(e.target.value)}
          disabled={disabled}
          className={fieldClass}
        >
          {configOptions.checkpoints.map((cp) => (
            <option key={cp} value={cp}>
              {cp}
            </option>
          ))}
        </select>
      </div>

      {/* Sampler + Scheduler */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <FieldLabel label="Sampler" tip="The sampling algorithm. dpmpp_2m gives crisp, detailed results." />
          <select
            value={sampler}
            onChange={(e) => setSampler(e.target.value)}
            disabled={disabled}
            className={fieldClass}
          >
            {configOptions.samplers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <FieldLabel label="Scheduler" tip="Controls how noise is reduced. 'karras' favors fine detail." />
          <select
            value={scheduler}
            onChange={(e) => setScheduler(e.target.value)}
            disabled={disabled}
            className={fieldClass}
          >
            {configOptions.schedulers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Steps + CFG + Denoise */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <FieldLabel label="Steps" tip="Sampling iterations. More steps = more refinement, slower. 30–40 is a good range." />
          <input
            type="number"
            value={steps}
            onChange={(e) => setSteps(parseInt(e.target.value) || 32)}
            min="10"
            max="100"
            disabled={disabled}
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel label="CFG" tip="Prompt adherence. Lower = more creative, higher = sticks to the prompt. 6–8 is balanced." />
          <input
            type="number"
            value={cfgScale}
            onChange={(e) => setCfgScale(parseFloat(e.target.value) || 7)}
            min="1"
            max="20"
            step="0.1"
            disabled={disabled}
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel label="Denoise" tip="How much the source image changes (img2img). 0.6 reinterprets boldly while keeping composition." />
          <input
            type="number"
            value={denoiseStrength}
            onChange={(e) => setDenoiseStrength(parseFloat(e.target.value) || 0.6)}
            min="0"
            max="1"
            step="0.05"
            disabled={disabled}
            className={fieldClass}
          />
        </div>
      </div>

      {/* Negative prompt */}
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

      {/* Detail & refinement */}
      <div className="space-y-3 border-t border-border pt-5">
        <FieldLabel
          label="Detail & refinement"
          tip="Post-processing that sharpens texture and adds fine detail. Tuned for your GPU — switch off for faster, lighter runs."
        />
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Hi-res detail pass" checked={hiresFix} onChange={setHiresFix} disabled={disabled} />
          <Toggle label="ControlNet Tile" checked={controlNet} onChange={setControlNet} disabled={disabled || !hiresFix} />
          <Toggle label="FreeU boost" checked={freeU} onChange={setFreeU} disabled={disabled} />
          <Toggle label="Quality tags" checked={qualityBoost} onChange={setQualityBoost} disabled={disabled} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <FieldLabel label="Upscale ×" tip="Final size vs the base image. 2.0 ≈ 2560px from a 1280px base. Higher = sharper and slower." />
            <input
              type="number"
              value={hiresFactor}
              onChange={(e) => setHiresFactor(parseFloat(e.target.value) || 1.5)}
              min="1"
              max="4"
              step="0.25"
              disabled={disabled || !hiresFix}
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel label="Refine denoise" tip="How much texture the refine pass redraws. Higher = more detail/change; lower = more faithful. 0.5–0.6 is a good range." />
            <input
              type="number"
              value={hiresDenoise}
              onChange={(e) => setHiresDenoise(parseFloat(e.target.value) || 0.45)}
              min="0"
              max="1"
              step="0.05"
              disabled={disabled || !hiresFix}
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel label="Tile strength" tip="How strongly ControlNet Tile holds the original structure during refine. Higher = more faithful." />
            <input
              type="number"
              value={controlNetStrength}
              onChange={(e) => setControlNetStrength(parseFloat(e.target.value) || 0.65)}
              min="0"
              max="2"
              step="0.05"
              disabled={disabled || !hiresFix || !controlNet}
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      {/* Action */}
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
