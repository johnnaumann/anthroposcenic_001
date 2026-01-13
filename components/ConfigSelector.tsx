'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    steps: number;
    cfgScale: number;
    denoiseStrength: number;
    negativePrompt: string;
  };
}

export function ConfigSelector({ description, onConfigSelected, disabled }: ConfigSelectorProps) {
  const [configOptions, setConfigOptions] = useState<ComfyUIConfigOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [checkpoint, setCheckpoint] = useState('');
  const [sampler, setSampler] = useState('');
  const [scheduler, setScheduler] = useState('normal');
  const [steps, setSteps] = useState(30);
  const [cfgScale, setCfgScale] = useState(7.5);
  const [denoiseStrength, setDenoiseStrength] = useState(0.45);
  const [negativePrompt, setNegativePrompt] = useState('blurry, bad quality, distorted, watermark, low quality');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/comfyui/config');
        if (!response.ok) {
          throw new Error('Failed to fetch configuration options');
        }
        const data = await response.json();
        setConfigOptions(data);
        
        // Set defaults
        if (data.checkpoints.length > 0) {
          setCheckpoint(data.checkpoints[0]);
        }
        if (data.samplers.length > 0) {
          setSampler(data.samplers[0]);
        }
        setScheduler(data.schedulers[0] || 'normal');
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

    const config: ComfyUIConfig = {
      description,
      checkpoint,
      sampler,
      scheduler,
      steps,
      cfgScale,
      denoiseStrength,
      negativePrompt,
    };

    onConfigSelected(config);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading configuration options...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!configOptions) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure ComfyUI Settings</CardTitle>
        <CardDescription>
          Select model, sampler, and other settings for image processing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Checkpoint Model</label>
            <select
              value={checkpoint}
              onChange={(e) => setCheckpoint(e.target.value)}
              disabled={disabled}
              className="w-full p-2 border rounded-md bg-background"
            >
              {configOptions.checkpoints.map((cp) => (
                <option key={cp} value={cp}>
                  {cp}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Sampler</label>
            <select
              value={sampler}
              onChange={(e) => setSampler(e.target.value)}
              disabled={disabled}
              className="w-full p-2 border rounded-md bg-background"
            >
              {configOptions.samplers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Scheduler</label>
            <select
              value={scheduler}
              onChange={(e) => setScheduler(e.target.value)}
              disabled={disabled}
              className="w-full p-2 border rounded-md bg-background"
            >
              {configOptions.schedulers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Steps</label>
            <input
              type="number"
              value={steps}
              onChange={(e) => setSteps(parseInt(e.target.value) || 30)}
              min="10"
              max="100"
              disabled={disabled}
              className="w-full p-2 border rounded-md bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CFG Scale</label>
            <input
              type="number"
              value={cfgScale}
              onChange={(e) => setCfgScale(parseFloat(e.target.value) || 7.5)}
              min="1"
              max="20"
              step="0.1"
              disabled={disabled}
              className="w-full p-2 border rounded-md bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Denoise Strength</label>
            <input
              type="number"
              value={denoiseStrength}
              onChange={(e) => setDenoiseStrength(parseFloat(e.target.value) || 0.45)}
              min="0"
              max="1"
              step="0.05"
              disabled={disabled}
              className="w-full p-2 border rounded-md bg-background"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Negative Prompt</label>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            disabled={disabled}
            className="w-full p-2 border rounded-md bg-background min-h-[80px] text-sm"
            placeholder="blurry, bad quality, distorted..."
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleProcess}
            disabled={disabled || !checkpoint || !sampler || !description.trim()}
          >
            Process Image
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
