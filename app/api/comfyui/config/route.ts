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
    
    // Get available models. SD1.5/SDXL checkpoints live in models/checkpoints; Flux
    // GGUF UNets live in models/unet (or diffusion_models). Merge both lists, with
    // Flux first so it's the default for artistic reinterpretation. Failed-download
    // stub files are tiny, so we drop anything below a sane minimum size.
    let checkpoints: string[] = [];
    // Resolved Flux GGUF filenames for the fast/quality toggle (schnell vs dev).
    let flux: { schnell: string | null; dev: string | null } = { schnell: null, dev: null };
    try {
      const MIN_BYTES = 100 * 1024 * 1024; // 100 MB

      const listModels = async (dir: string, exts: string[]): Promise<string[]> => {
        try {
          const p = join(process.cwd(), dir);
          const files = await readdir(p);
          const candidates = files.filter((f) => exts.some((e) => f.endsWith(e)));
          const withSizes = await Promise.all(
            candidates.map(async (file) => {
              try {
                const { size } = await stat(join(p, file));
                return { file, size };
              } catch {
                return { file, size: 0 };
              }
            })
          );
          return withSizes.filter(({ size }) => size >= MIN_BYTES).map(({ file }) => file).sort();
        } catch {
          return [];
        }
      };

      const sdModels = await listModels(COMFYUI_MODELS_DIR, ['.safetensors', '.ckpt']);
      const fluxModels = [
        ...(await listModels('./comfyui/models/unet', ['.gguf', '.safetensors'])),
        ...(await listModels('./comfyui/models/diffusion_models', ['.gguf', '.safetensors'])),
      ].filter((f) => /flux|\.gguf$/i.test(f));

      flux = {
        schnell: fluxModels.find((f) => /schnell/i.test(f)) ?? null,
        dev: fluxModels.find((f) => /dev/i.test(f)) ?? fluxModels.find((f) => !/schnell/i.test(f)) ?? null,
      };

      // Order SD checkpoints: SDXL > DreamShaper > the rest (stable sort).
      const SDXL_PATTERN = /(sdxl|juggernaut|playground|pony|dreamshaperxl|[-_.]xl[-_.]?)/i;
      const rank = (cp: string) => (SDXL_PATTERN.test(cp) ? 0 : /dreamshaper/i.test(cp) ? 1 : 2);
      const sortedSd = Array.from(new Set(sdModels)).sort((a, b) => rank(a) - rank(b));

      // Surface Flux as a single "Flux" option (the schnell/dev variant is chosen by the
      // fast/quality toggle in the UI), listed first, then the SD checkpoints.
      checkpoints = [...(flux.schnell || flux.dev ? ['Flux'] : []), ...sortedSd];
    } catch (error) {
      console.warn('Could not read model directories:', error);
      checkpoints = ['DreamShaper_8_pruned.safetensors', 'Deliberate_v2.safetensors'];
    }
    
    // Schedulers are fixed options
    const schedulers = ['normal', 'karras', 'exponential', 'simple'];
    
    return NextResponse.json({
      checkpoints,
      flux,
      samplers,
      schedulers,
      defaults: {
        // SD1.5/SDXL knobs. (Flux ignores sampler/scheduler/CFG — it uses euler/simple
        // + guidance 3.5 internally — and the hi-res/FreeU/ControlNet options below.)
        sampler: 'dpmpp_2m',
        scheduler: 'karras',
        steps: 28,
        cfgScale: 7,
        // 0.85 is a bold reinterpretation that "riffs" on the source while still
        // acknowledging its composition/style. Lower it toward 0.5 to stay closer.
        denoiseStrength: 0.85,
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
