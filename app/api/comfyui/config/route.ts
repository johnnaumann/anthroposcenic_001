import { NextResponse } from 'next/server';
import { DEFAULT_NEGATIVE_PROMPT } from '@/lib/comfyui-defaults';
import { getAvailableSamplers } from '@/lib/comfyui';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

const COMFYUI_MODELS_DIR = process.env.COMFYUI_MODELS_DIR || './comfyui/models/checkpoints';

/**
 * GET /api/comfyui/config
 * Returns available ComfyUI configuration options (models, samplers, schedulers)
 */
export async function GET() {
  try {
    // Get available samplers
    const samplers = await getAvailableSamplers();
    
    // Get available checkpoints/models
    let checkpoints: string[] = [];
    try {
      const checkpointsPath = join(process.cwd(), COMFYUI_MODELS_DIR);
      const files = await readdir(checkpointsPath);

      // Filter to real checkpoint files only. Failed/aborted downloads leave tiny
      // stub files (e.g. an HTML error body or "Entry not found") that crash ComfyUI
      // if selected, so we drop anything below a sane minimum size.
      const MIN_CHECKPOINT_BYTES = 100 * 1024 * 1024; // 100 MB
      const candidates = files.filter(
        file => file.endsWith('.safetensors') || file.endsWith('.ckpt')
      );
      const withSizes = await Promise.all(
        candidates.map(async (file) => {
          try {
            const { size } = await stat(join(checkpointsPath, file));
            return { file, size };
          } catch {
            return { file, size: 0 };
          }
        })
      );
      checkpoints = withSizes
        .filter(({ size }) => size >= MIN_CHECKPOINT_BYTES)
        .map(({ file }) => file)
        .sort();

      // Order so the best default lands first in the dropdown:
      // SDXL (if installed) > DreamShaper > everything else. Array.sort is stable,
      // so alphabetical order is preserved within each tier.
      const SDXL_PATTERN = /(sdxl|juggernaut|playground|pony|dreamshaperxl|[-_.]xl[-_.]?)/i;
      const rank = (cp: string) =>
        SDXL_PATTERN.test(cp) ? 0 : /dreamshaper/i.test(cp) ? 1 : 2;
      checkpoints.sort((a, b) => rank(a) - rank(b));
    } catch (error) {
      console.warn('Could not read checkpoints directory:', error);
      // Return common defaults
      checkpoints = [
        'DreamShaper_8_pruned.safetensors',
        'Deliberate_v2.safetensors',
        'sd-v1-5.safetensors',
        'revAnimated_v122.safetensors'
      ];
    }
    
    // Schedulers are fixed options
    const schedulers = ['normal', 'karras', 'exponential', 'simple'];
    
    return NextResponse.json({
      checkpoints,
      samplers,
      schedulers,
      defaults: {
        // dpmpp_2m + karras gives noticeably crisper detail than euler/normal.
        sampler: 'dpmpp_2m',
        scheduler: 'karras',
        steps: 32,
        cfgScale: 7,
        // 0.6 reinterprets the image enough to be genuinely "interesting" while
        // keeping the original composition; the hires-fix pass restores fine detail.
        denoiseStrength: 0.6,
        negativePrompt: DEFAULT_NEGATIVE_PROMPT,
        // Detail & refinement. Tuned for Apple-Silicon MPS: the ESRGAN + refine
        // pass adds the crisp texture; ControlNet Tile is OFF by default because
        // it's very slow on MPS at hi-res (opt-in when you can wait). Push the
        // Upscale × higher for more final resolution at the cost of time.
        hiresFix: true,
        hiresFactor: 1.5,
        hiresDenoise: 0.45,
        controlNet: false,
        controlNetStrength: 0.65,
        freeU: true,
        qualityBoost: true,
      },
    });
  } catch (error) {
    console.error('Error getting ComfyUI config:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get ComfyUI configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
