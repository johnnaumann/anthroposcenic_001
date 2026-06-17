# Scripts

## Day to day

| Command | Description |
|---------|-------------|
| `npm run dev` | Ollama + Next.js + open browser when ready |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |

`dev` runs three helpers internally: `dev:next`, `dev:ollama`, `dev:open`. Use those only if you need a single service.

## First-time setup

| Command | Description |
|---------|-------------|
| `npm run setup` | Ollama describe model + ComfyUI install + Flux GGUF |
| `npm run setup:ollama` | Rebuild `anthroposcenic-describe:latest` only |
| `npm run setup:comfyui` | ComfyUI venv + Flux GGUF only |

Install Ollama itself first (`brew install ollama` or https://ollama.com/download).

## Optional

| Command | Description |
|---------|-------------|
| `npm run comfyui:sd` | SD checkpoints + upscale + ControlNet Tile |
| `npm run comfyui:run` | Start ComfyUI manually (`:8188`; app auto-starts on process) |

ComfyUI auto-starts from the app on first process (`lib/comfyui-startup.ts`). SD checkpoints can also download on demand via `lib/model-downloader.ts`.

## Shell scripts (advanced)

Diagnostics and extras live in `scripts/` and are not wired to npm:

| Script | Purpose |
|--------|---------|
| `check-ollama.sh` | Ollama health check |
| `setup-ollama.sh` | Verify Ollama install |
| `check-comfyui-samplers.sh` | List samplers (ComfyUI must be running) |
| `install-all-samplers.sh` | Optional custom-node sampler packs |

Run with `bash scripts/<name>.sh`.
