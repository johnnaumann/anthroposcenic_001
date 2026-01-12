import { NextRequest, NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

/**
 * Kill and restart Ollama and ComfyUI services
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Services] Restarting Ollama and ComfyUI...');

    // Kill existing processes
    console.log('[Services] Stopping existing processes...');
    
    // Kill Ollama processes
    try {
      // Try to kill ollama processes (ignore errors if not running)
      await execAsync('pkill -f "ollama serve" 2>/dev/null || true');
      await execAsync('pkill ollama 2>/dev/null || true');
      console.log('[Services] Ollama processes stopped');
    } catch (error) {
      // Ignore errors - processes may not be running
      console.log('[Services] Ollama processes stopped (or not running)');
    }

    // Kill ComfyUI processes
    try {
      // Kill any Python processes running ComfyUI main.py
      await execAsync('pkill -f "python.*main.py" 2>/dev/null || true');
      await execAsync('pkill -f "python.*comfyui" 2>/dev/null || true');
      console.log('[Services] ComfyUI processes stopped');
    } catch (error) {
      // Ignore errors - processes may not be running
      console.log('[Services] ComfyUI processes stopped (or not running)');
    }

    // Wait for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Restart Ollama
    console.log('[Services] Starting Ollama...');
    let ollamaReady = false;
    try {
      // Start Ollama in background using spawn for better control
      const ollamaProcess = spawn('ollama', ['serve'], {
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      ollamaProcess.unref(); // Allow parent process to exit
      
      // Wait for Ollama to be ready (max 30 seconds)
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const response = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            signal: AbortSignal.timeout(2000),
          });
          if (response.ok) {
            ollamaReady = true;
            console.log('[Services] Ollama is ready');
            break;
          }
        } catch (error) {
          // Not ready yet, continue waiting
        }
      }
      
      if (!ollamaReady) {
        console.warn('[Services] Ollama did not become ready within 30 seconds');
      }
    } catch (error) {
      console.error('[Services] Error restarting Ollama:', error);
      // Continue anyway - Ollama might already be running
    }

    // Restart ComfyUI
    console.log('[Services] Starting ComfyUI...');
    let comfyuiReady = false;
    try {
      const projectRoot = process.cwd();
      const comfyuiDir = join(projectRoot, 'comfyui');
      
      // Check if ComfyUI is set up
      if (!existsSync(join(comfyuiDir, 'venv'))) {
        return NextResponse.json(
          { error: 'ComfyUI not set up. Run: npm run comfyui:setup' },
          { status: 500 }
        );
      }

      // Set environment variables for macOS
      const env = { ...process.env };
      if (process.platform === 'darwin') {
        env.PYTORCH_ENABLE_MPS_FALLBACK = '0';
        env.PYTORCH_MPS_HIGH_WATERMARK_RATIO = '0.0';
        env.PYTORCH_MPS_ENABLE = '0';
        env.PYTHONDONTWRITEBYTECODE = '1';
      }

      // Build command arguments
      const pythonPath = join(comfyuiDir, 'venv', 'bin', 'python');
      const mainPy = join(comfyuiDir, 'main.py');
      const memoryMode = process.env.COMFYUI_MEMORY_MODE || (process.platform === 'darwin' ? '--cpu' : '');
      const args = ['-B', mainPy, '--port', '8188'];
      
      if (memoryMode) {
        args.push(memoryMode);
        if (process.platform === 'darwin' && memoryMode === '--cpu') {
          args.push('--use-split-cross-attention');
        }
      }

      // Start ComfyUI in background using spawn
      const comfyuiProcess = spawn(pythonPath, args, {
        cwd: comfyuiDir,
        env,
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      comfyuiProcess.unref(); // Allow parent process to exit

      // Wait for ComfyUI to be ready (max 60 seconds)
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const response = await fetch('http://localhost:8188/system_stats', {
            method: 'GET',
            signal: AbortSignal.timeout(2000),
          });
          if (response.ok) {
            comfyuiReady = true;
            console.log('[Services] ComfyUI is ready');
            break;
          }
        } catch (error) {
          // Not ready yet, continue waiting
        }
      }

      if (!comfyuiReady) {
        console.warn('[Services] ComfyUI did not become ready within 60 seconds');
        // Return success anyway - it might still be starting
      }

      return NextResponse.json({
        success: true,
        message: 'Services restarted successfully',
        ollama: ollamaReady ? 'ready' : 'starting',
        comfyui: comfyuiReady ? 'ready' : 'starting',
      });
    } catch (error) {
      console.error('[Services] Error restarting ComfyUI:', error);
      return NextResponse.json(
        { error: 'Failed to restart ComfyUI', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Services] Error restarting services:', error);
    return NextResponse.json(
      { error: 'Failed to restart services', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
