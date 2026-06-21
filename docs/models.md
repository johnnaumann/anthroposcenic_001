# Models

## Ollama (describe step)

**Runtime default:** `anthroposcenic-describe:latest` (from `config/models.json`).

```bash
npm run setup:ollama
```

Reads `config/ollama-modelfile`, pulls `llava:7b` if missing (`FROM llava:7b`), and creates `anthroposcenic-describe:latest`.

Override at runtime: `OLLAMA_MODEL` in `.env.local` or `model` in the describe request body.

The modelfile `SYSTEM` block is intentionally minimal (vision assistant, follow user instructions). The art-critic prompt format lives in `lib/describe-route.ts` (`buildDescribePrompt`) and is sent as the user message on each describe request. Recreate the model after modelfile edits (`npm run setup:ollama`).

Health check: `bash scripts/check-ollama.sh`

## ComfyUI

### Setup (Flux default)

```bash
npm run setup:comfyui
```

Or full first-time setup:

```bash
npm run setup
```

Installs ComfyUI venv plus:

- `custom_nodes/ComfyUI-GGUF`
- `models/unet/flux1-dev-Q4_K_S.gguf` and `flux1-schnell-Q4_K_S.gguf`
- Flux CLIP + T5 encoders and VAE

UI labels: **Fast** (schnell) / **Slow** (dev).

### Stable Diffusion (optional)

```bash
npm run comfyui:sd
```

Downloads SD checkpoints, upscale model (hi-res pass), and ControlNet Tile. You can also place `.safetensors` manually in `comfyui/models/checkpoints/`.

SD checkpoints can auto-download via `lib/model-downloader.ts` when the process route requests a missing file. Flux GGUF is not auto-downloaded through that path — use `npm run setup:comfyui`.

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

Registry: `lib/model-downloader.ts`.
