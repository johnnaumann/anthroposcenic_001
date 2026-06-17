# Models

## Ollama (describe step)

**Runtime default:** `anthroposcenic-describe:latest` (from `config/models.json`).

**Build the describe model:**

```bash
npm run ollama:modelfile
```

This reads `config/ollama-modelfile`, pulls `llava:7b` if missing (`FROM llava:7b`), and creates `anthroposcenic-describe:latest`.

| Command | Purpose |
|---------|---------|
| `npm run ollama:modelfile` | Create/update describe model (required) |
| `npm run ollama:check` | Verify Ollama is reachable |
| `npm run ollama:setup` | Verify install and list models |

Override at runtime: `OLLAMA_MODEL` in `.env.local` or `model` in the describe request body.

The modelfile `SYSTEM` block is legacy tag-oriented text; the live describe route sends its own art-critic user prompt in `app/api/describe/route.ts`. Recreate the model after modelfile edits.

## ComfyUI

### Setup

```bash
npm run comfyui:setup
```

### Flux (default when installed)

```bash
npm run comfyui:flux
```

Installs:

- `custom_nodes/ComfyUI-GGUF`
- `models/unet/flux1-dev-Q4_K_S.gguf` and `flux1-schnell-Q4_K_S.gguf`
- Flux CLIP + T5 encoders and VAE

UI labels: **Fast** (schnell) / **Slow** (dev).

### Stable Diffusion checkpoints

```bash
npm run comfyui:download-all
npm run comfyui:upscaler          # hi-res pass
npm run comfyui:controlnet-tile   # ControlNet Tile
```

Place `.safetensors` manually in `comfyui/models/checkpoints/`.

SD checkpoints can auto-download via `lib/model-downloader.ts` when the process route requests a missing file. Flux GGUF is not auto-downloaded through that path — use `comfyui:flux`.

### Samplers

```bash
npm run comfyui:samplers
npm run comfyui:install-all-samplers   # optional
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
