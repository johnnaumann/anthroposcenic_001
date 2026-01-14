'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
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
        
        // Set defaults - prioritize DreamShaper if available
        if (data.checkpoints.length > 0) {
          const dreamshaperIndex = data.checkpoints.findIndex((cp: string) => 
            cp.includes('DreamShaper')
          );
          if (dreamshaperIndex >= 0) {
            setCheckpoint(data.checkpoints[dreamshaperIndex]);
          } else {
            setCheckpoint(data.checkpoints[0]);
          }
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Checkpoint Model</label>
              <Tooltip content="The base AI model that determines the artistic style and capabilities. Different models produce different visual styles (realistic, abstract, anime, etc.). Choose based on the aesthetic you want to achieve.">
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </Tooltip>
            </div>
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Sampler</label>
              <Tooltip content="The algorithm used to generate the image. Different samplers produce different results: some are faster, some are more creative, and some produce higher quality. Euler and DPM++ variants are popular choices.">
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </Tooltip>
            </div>
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Scheduler</label>
              <Tooltip content="Controls how the noise is reduced during generation. 'karras' is popular for quality, 'normal' is balanced, 'exponential' can be more creative. Affects the final image quality and style.">
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </Tooltip>
            </div>
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Steps</label>
              <Tooltip content="Number of iterations the AI takes to generate the image. Higher values (30-50) produce better quality but take longer. Lower values (10-20) are faster but may have less detail. Recommended: 20-40 for most use cases.">
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </Tooltip>
            </div>
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">CFG Scale</label>
              <Tooltip content="How closely the AI follows your prompt. Lower values (5-7) allow more creative interpretation and variation. Higher values (8-12) stick closer to the prompt but may be less creative. Recommended: 7-9 for balanced results.">
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </Tooltip>
            </div>
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Denoise Strength</label>
              <Tooltip content="How much the input image is modified (for img2img mode). Lower values (0.3-0.5) preserve more of the original image. Higher values (0.6-0.9) create more variation and artistic interpretation. Only applies when using an uploaded image.">
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </Tooltip>
            </div>
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
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Negative Prompt</label>
            <Tooltip content="Things you want to avoid in the generated image. Common terms: 'blurry', 'bad quality', 'distorted', 'watermark', 'low quality'. Adding 'realistic' or 'photorealistic' can push results toward more abstract/artistic styles.">
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </Tooltip>
          </div>
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
