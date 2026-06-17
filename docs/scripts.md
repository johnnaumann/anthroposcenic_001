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
| `npm run ollama:setup` | Install Ollama (platform helper) |
| `npm run ollama:check` | Health check |
| `npm run ollama:models` | Pull vision models + build describe model |
| `npm run ollama:modelfile` | Build `anthroposcenic-describe:latest` |
| `npm run ollama:modelfile:transform` | Build transform model |

## ComfyUI

| Command | Description |
|---------|-------------|
| `npm run comfyui:setup` | Clone ComfyUI, venv, requirements |
| `npm run comfyui:run` | Start ComfyUI (`:8188`) |
| `npm run comfyui:flux` | Flux GGUF stack |
| `npm run comfyui:download-all` | Bulk model download script |
| `npm run comfyui:models` | Install ComfyUI models (check script) |
| `npm run comfyui:install-creative-models` | Artistic SD checkpoints |
| `npm run comfyui:upscaler` | ESRGAN-style upscale model |
| `npm run comfyui:controlnet-tile` | ControlNet Tile weights |
| `npm run comfyui:samplers` | Print available samplers |
| `npm run comfyui:install-extra-samplers` | Extra samplers node pack |
| `npm run comfyui:install-all-samplers` | Full sampler bundle |

Shell scripts live in `scripts/`; npm scripts are the supported entry points.
