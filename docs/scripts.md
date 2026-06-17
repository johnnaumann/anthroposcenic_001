# Scripts

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Ollama + Next.js + open browser when ready |
| `npm run dev:next` | Next.js only (`:3000`) |
| `npm run dev:ollama` | Ollama startup script |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |

## Ollama

| Command | Description |
|---------|-------------|
| `npm run ollama:setup` | Verify Ollama install and running |
| `npm run ollama:check` | Health check |
| `npm run ollama:modelfile` | Build `anthroposcenic-describe:latest` (required) |

## ComfyUI

| Command | Description |
|---------|-------------|
| `npm run comfyui:setup` | Clone ComfyUI, venv, requirements |
| `npm run comfyui:run` | Start ComfyUI manually (`:8188`) |
| `npm run comfyui:flux` | Flux GGUF stack (default generation) |
| `npm run comfyui:download-all` | SD checkpoint bulk download |
| `npm run comfyui:upscaler` | ESRGAN upscale model (SD hi-res pass) |
| `npm run comfyui:controlnet-tile` | ControlNet Tile weights (SD refine) |
| `npm run comfyui:samplers` | Print available samplers (ComfyUI must be running) |
| `npm run comfyui:install-all-samplers` | Optional custom-node sampler packs |

Shell scripts live in `scripts/`; npm scripts are the supported entry points.

ComfyUI also auto-starts from the app on first process (`lib/comfyui-startup.ts`); `comfyui:run` is for manual debugging.
