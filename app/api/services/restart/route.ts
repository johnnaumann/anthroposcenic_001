import { NextRequest, NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

/**
 * Check and optionally start Ollama and ComfyUI services if not running
 * Does NOT kill existing processes - services continue running once started
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Services] Checking Ollama and ComfyUI status...');

    // Check if Ollama is running and responding
    let ollamaReady = false;
    try {
      const ollamaCheck = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (ollamaCheck.ok) {
        ollamaReady = true;
        console.log('[Services] Ollama is already running and responding');
      }
    } catch (error) {
      console.log('[Services] Ollama not responding');
    }

    // Check if ComfyUI is running and responding
    let comfyuiReady = false;
    try {
      const comfyuiCheck = await fetch('http://localhost:8188/system_stats', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (comfyuiCheck.ok) {
        comfyuiReady = true;
        console.log('[Services] ComfyUI is already running and responding');
      }
    } catch (error) {
      console.log('[Services] ComfyUI not responding');
    }

    // Start Ollama only if not running
    if (!ollamaReady) {
      console.log('[Services] Starting Ollama...');
      try {
        // Start Ollama in background using spawn for better control
        const ollamaProcess = spawn('ollama', ['serve'], {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'], // Capture output for debugging
        });
        
        // Store process ID for potential cleanup
        const ollamaPid = ollamaProcess.pid;
        console.log(`[Services] Started Ollama process (PID: ${ollamaPid})`);
        
        // Don't unref immediately - wait a bit to ensure it starts
        await new Promise(resolve => setTimeout(resolve, 2000));
        ollamaProcess.unref(); // Allow parent process to exit
      
        // Wait for Ollama to be ready (max 60 seconds with more frequent checks)
        for (let i = 0; i < 60; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            const response = await fetch('http://localhost:11434/api/tags', {
              method: 'GET',
              signal: AbortSignal.timeout(3000),
            });
            if (response.ok) {
              ollamaReady = true;
              console.log(`[Services] Ollama is ready (after ${i + 1} seconds)`);
              break;
            }
          } catch (error) {
            // Not ready yet, continue waiting
            if (i % 5 === 0) {
              console.log(`[Services] Waiting for Ollama... (${i + 1}s)`);
            }
          }
        }
        
        if (!ollamaReady) {
          console.warn('[Services] Ollama did not become ready within 60 seconds');
          // Try one more check after a longer wait
          await new Promise(resolve => setTimeout(resolve, 5000));
          try {
            const finalCheck = await fetch('http://localhost:11434/api/tags', {
              method: 'GET',
              signal: AbortSignal.timeout(5000),
            });
            if (finalCheck.ok) {
              ollamaReady = true;
              console.log('[Services] Ollama is ready (after extended wait)');
            }
          } catch (error) {
            console.error('[Services] Ollama still not responding after extended wait');
          }
        }
      } catch (error) {
        console.error('[Services] Error starting Ollama:', error);
        // Continue anyway - Ollama might already be running
      }
    }

    // Start ComfyUI only if not running
    if (!comfyuiReady) {
      console.log('[Services] Starting ComfyUI...');
      try {
        const projectRoot = process.cwd();
        const comfyuiDir = join(projectRoot, 'comfyui');
      
        // Check if ComfyUI is set up
        if (!existsSync(join(comfyuiDir, 'venv'))) {
          console.error('[Services] ComfyUI not set up. Run: npm run comfyui:setup');
          // Don't return error, just log it
        } else {
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
        }

        if (!comfyuiReady) {
          console.warn('[Services] ComfyUI did not become ready within 60 seconds');
          // Continue anyway - it might still be starting
        }
      } catch (error) {
        console.error('[Services] Error starting ComfyUI:', error);
        // Continue anyway - ComfyUI might already be running
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Services checked/started successfully',
      ollama: ollamaReady ? 'ready' : 'starting',
      comfyui: comfyuiReady ? 'ready' : 'starting',
    });
  } catch (error) {
    console.error('[Services] Error checking/starting services:', error);
    return NextResponse.json(
      { error: 'Failed to check/start services', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
