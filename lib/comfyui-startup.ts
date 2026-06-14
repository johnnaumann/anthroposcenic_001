/**
 * ComfyUI startup and management utilities
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { checkComfyUIAvailability } from './comfyui';

const COMFYUI_HOST = process.env.COMFYUI_HOST || 'http://localhost:8188';

/**
 * Start ComfyUI if not already running
 * Returns true if ComfyUI is ready, false if failed
 */
export async function startComfyUI(): Promise<boolean> {
  // Check if already running
  const isAvailable = await checkComfyUIAvailability();
  if (isAvailable) {
    console.log('[ComfyUI Startup] ComfyUI is already running');
    return true;
  }

  console.log('[ComfyUI Startup] Starting ComfyUI...');
  
  const projectRoot = process.cwd();
  const comfyuiDir = join(projectRoot, 'comfyui');
  
  // Check if ComfyUI is set up
  if (!existsSync(join(comfyuiDir, 'venv'))) {
    console.error('[ComfyUI Startup] ComfyUI not set up. Run: npm run comfyui:setup');
    return false;
  }

  // Set environment variables for macOS
  const env = { ...process.env };
  if (process.platform === 'darwin') {
    // Apple Silicon: use the Metal (MPS) GPU. Fall back to CPU for any op MPS
    // doesn't support yet, rather than erroring out.
    env.PYTORCH_ENABLE_MPS_FALLBACK = '1';
    env.PYTHONDONTWRITEBYTECODE = '1';
  }

  // Build command arguments
  const pythonPath = join(comfyuiDir, 'venv', 'bin', 'python');
  const mainPy = join(comfyuiDir, 'main.py');
  // Empty → ComfyUI auto-detects the best device (MPS on Apple Silicon, CUDA on
  // NVIDIA). Only force a mode if COMFYUI_MEMORY_MODE is explicitly set.
  const memoryMode = process.env.COMFYUI_MEMORY_MODE || '';
  const args = ['-B', mainPy, '--port', '8188'];
  
  if (memoryMode) {
    args.push(memoryMode);
    if (process.platform === 'darwin' && memoryMode === '--cpu') {
      args.push('--use-split-cross-attention');
    }
  }

  try {
    // Start ComfyUI in background
    const comfyuiProcess = spawn(pythonPath, args, {
      cwd: comfyuiDir,
      env,
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    comfyuiProcess.unref(); // Allow parent process to exit

    console.log(`[ComfyUI Startup] Started ComfyUI process (PID: ${comfyuiProcess.pid})`);

    // Wait for ComfyUI to be ready (max 60 seconds)
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const isReady = await checkComfyUIAvailability();
      if (isReady) {
        console.log(`[ComfyUI Startup] ✅ ComfyUI is ready (after ${i + 1} seconds)`);
        return true;
      }
      if (i % 5 === 0) {
        console.log(`[ComfyUI Startup] Waiting for ComfyUI... (${i + 1}s)`);
      }
    }

    console.warn('[ComfyUI Startup] ComfyUI did not become ready within 60 seconds');
    return false;
  } catch (error) {
    console.error('[ComfyUI Startup] Error starting ComfyUI:', error);
    return false;
  }
}
