'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { HelpCircle, Loader2, ArrowRight } from 'lucide-react';
import { ComfyUIConfig } from '@/types';

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

      {/* Action */}
      <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
        <p className="truncate text-xs text-muted-foreground">
          {checkpoint} · {steps} steps · denoise {denoiseStrength} · hi-res pass on
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
