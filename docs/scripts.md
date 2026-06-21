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
| `npm run setup` | Pull `llava:7b` + ComfyUI install + Flux GGUF |
| `npm run setup:ollama` | Pull `llava:7b` only (skips if already installed) |
| `npm run setup:comfyui` | ComfyUI venv + Flux GGUF only |

Install Ollama itself first (`brew install ollama` or https://ollama.com/download).

**ComfyUI reinstall:** `FORCE=1 npm run setup:comfyui` removes a broken or partial `comfyui/` and reinstalls.

**Python:** ComfyUI needs Python 3.10–3.12. Pins in `.tool-versions` (asdf). Override: `PYTHON=python3.12 bash scripts/setup-comfyui.sh`.

**npm registry:** project `.npmrc` uses the public registry so `npm install` works without a corporate npm config.

## Optional

| Command | Description |
|---------|-------------|
| `npm run comfyui:sd` | SD checkpoints + upscale + ControlNet Tile |
| `npm run comfyui:run` | Start ComfyUI manually (`:8188`; app auto-starts on process) |

ComfyUI auto-starts from the app on first process (`lib/comfyui-startup.ts`). SD checkpoints can also download on demand via `lib/model-downloader.ts` during processing.

## Shell scripts (advanced)

Diagnostics and extras live in `scripts/` and are not wired to npm:

| Script | Purpose |
|--------|---------|
| `pull-ollama-model.sh` | Called by `npm run setup:ollama` |
| `setup-ollama.sh` | Verify Ollama install and list models |
| `start-ollama.sh` | Called by `npm run dev:ollama` |
| `check-ollama.sh` | Ollama health check |
| `setup-comfyui.sh` | ComfyUI venv setup |
| `download-flux.sh` | Flux GGUF + encoders |
| `download-all-models.sh` | SD checkpoints (used by `comfyui:sd`) |
| `run-comfyui.sh` | Manual ComfyUI start |
| `check-comfyui-samplers.sh` | List samplers (ComfyUI must be running) |
| `install-all-samplers.sh` | Optional custom-node sampler packs |

Run with `bash scripts/<name>.sh`.
