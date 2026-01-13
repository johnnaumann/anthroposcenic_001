import { NextResponse } from 'next/server';
import { getAvailableSamplers } from '@/lib/comfyui';
import { readdir } from 'fs/promises';
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
      checkpoints = files
        .filter(file => file.endsWith('.safetensors') || file.endsWith('.ckpt'))
        .sort();
    } catch (error) {
      console.warn('Could not read checkpoints directory:', error);
      // Return common defaults
      checkpoints = [
        'Deliberate_v2.safetensors',
        'DreamShaper_8.safetensors',
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
        steps: 30,
        cfgScale: 7.5,
        denoiseStrength: 0.45,
        negativePrompt: 'blurry, bad quality, distorted, watermark, low quality',
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
