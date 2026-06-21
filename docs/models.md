# Models

## Ollama (describe step)

**Runtime default:** `llava:7b` (`config/models.json`, overridable via `OLLAMA_MODEL`).

There is no custom `anthroposcenic-describe` wrapper. The app calls Ollama directly with the vision model and sends the describe prompt as the user message.

### Setup

```bash
npm run setup:ollama
```

Pulls `llava:7b` if not already installed. Or as part of full setup:

```bash
npm run setup    # llava:7b + ComfyUI + Flux
```

### Prompt ownership

All describe instructions live in the app:

| Layer | File | Role |
|-------|------|------|
| Output format | `lib/describe-route.ts` | `buildDescribePrompt()` — natural-language description + style tags |
| Length cap | `lib/prompt-limits.ts` | ~220 words / 80 tags |

Change describe wording in `buildDescribePrompt()`. No modelfile to maintain.

### Overrides

| Method | Example |
|--------|---------|
| Environment | `OLLAMA_MODEL=qwen3-vl:8b` in `.env.local` |
| API body | `{ "imageId": "…", "model": "qwen3-vl:8b" }` |

Alternate vision models are listed in `config/models.json` under `ollama.vision`. The UI does not expose a model picker by default.

Health check: `bash scripts/check-ollama.sh`

## ComfyUI

### Setup (Flux default)

```bash
npm run setup:comfyui
```

Installs ComfyUI venv plus:

- `custom_nodes/ComfyUI-GGUF`
- `models/unet/flux1-dev-Q4_K_S.gguf` and `flux1-schnell-Q4_K_S.gguf`
- Flux CLIP + T5 encoders and VAE

UI labels: **Fast** (schnell) / **Slow** (dev). Workflows: `lib/comfyui-workflow.ts`.

### Stable Diffusion (optional)

```bash
npm run comfyui:sd
```

Downloads SD checkpoints, upscale model (hi-res pass), and ControlNet Tile. You can also place `.safetensors` manually in `comfyui/models/checkpoints/`.

SD workflows: `lib/comfyui-workflow-sd.ts`, hi-res: `lib/comfyui-workflow-sd-hires.ts`.

SD checkpoints can auto-download via `lib/model-downloader.ts` when the process route requests a missing file. Flux GGUF is **not** auto-downloaded through that path — use `npm run setup:comfyui`.

### Samplers

Core ComfyUI includes `dpmpp_2m` (the UI default). For extra samplers:

```bash
bash scripts/install-all-samplers.sh
bash scripts/check-comfyui-samplers.sh   # ComfyUI must be running
```

Restart ComfyUI after installing custom nodes.

## Abstract / artistic SD checkpoints

Listed in configure when present in `checkpoints/`:

| File | Notes |
|------|-------|
| `openjourney-v4.safetensors` | `mdjrny-v4 style` in prompt |
| `protogen-v2.2.safetensors` | Creative merge |
| `analog-diffusion.safetensors` | `analog style` |
| `inkpunk-diffusion.safetensors` | Cyberpunk / inkpunk |
| `pastel-mix.safetensors` | Soft pastels |
| `waifu-diffusion.safetensors` | Anime-influenced |
| `epic-diffusion.safetensors` | General merge |

Download URLs: `lib/model-downloader.ts`.
