import { NextResponse } from 'next/server';
import { getAvailableSamplers } from '@/lib/comfyui';
import { readdir, lstat } from 'fs/promises';
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
      
      // Filter checkpoint files and handle symlinks
      const checkpointFiles = files.filter(file => 
        file.endsWith('.safetensors') || file.endsWith('.ckpt')
      );
      
      // Build a map of symlink targets to avoid duplicates
      const symlinkTargets = new Set<string>();
      const checkpointMap = new Map<string, string>(); // symlink -> target
      
      for (const file of checkpointFiles) {
        const filePath = join(checkpointsPath, file);
        try {
          const stats = await lstat(filePath);
          if (stats.isSymbolicLink()) {
            // This is a symlink - resolve it to get the target
            const { readlink } = await import('fs/promises');
            const target = await readlink(filePath);
            // Handle both absolute and relative symlink targets
            const targetName = target.startsWith('/') 
              ? target.split('/').pop() || target
              : join(checkpointsPath, target).split('/').pop() || target;
            symlinkTargets.add(targetName);
            checkpointMap.set(file, targetName);
          }
        } catch {
          // If we can't read the symlink, just continue
        }
      }
      
      // Filter out files that are targets of symlinks (prefer showing the symlink name)
      checkpoints = checkpointFiles
        .filter(file => {
          // If this file is a symlink target, exclude it (we'll show the symlink instead)
          if (symlinkTargets.has(file)) {
            // Check if there's a symlink pointing to this file
            for (const [symlink, target] of checkpointMap.entries()) {
              if (target === file) {
                // There's a symlink pointing to this file, prefer the symlink
                return false;
              }
            }
          }
          return true;
        })
        .sort();
      
      // Prioritize DreamShaper_8.safetensors if it exists (even as symlink)
      const dreamshaperIndex = checkpoints.indexOf('DreamShaper_8.safetensors');
      if (dreamshaperIndex > 0) {
        // Move it to the front
        checkpoints.splice(dreamshaperIndex, 1);
        checkpoints.unshift('DreamShaper_8.safetensors');
      }
    } catch (error) {
      console.warn('Could not read checkpoints directory:', error);
      // Return common defaults
      checkpoints = [
        'DreamShaper_8.safetensors',
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
