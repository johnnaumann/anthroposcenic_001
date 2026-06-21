# Configuration

## Environment variables

Create `.env.local` in the project root. All optional unless noted.

```env
# Ollama
OLLAMA_HOST=http://localhost:11434
# OLLAMA_MODEL=llava:7b

# ComfyUI
COMFYUI_HOST=http://localhost:8188
COMFYUI_WS_URL=ws://localhost:8188/ws
# COMFYUI_MEMORY_MODE=--cpu

# Flux model filenames (defaults shown)
# FLUX_CLIP_L=clip_l.safetensors
# FLUX_T5=t5xxl_fp8_e4m3fn.safetensors
# FLUX_VAE=ae.safetensors

# Upload / storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Upload compression (Sharp — lib/image-processing.ts)
MAX_IMAGE_WIDTH=1024
MAX_IMAGE_HEIGHT=1024
JPEG_QUALITY=85
PNG_QUALITY=90
WEBP_QUALITY=85
```

### Ollama model selection

| Source | Precedence |
|--------|------------|
| `model` field in `/api/describe` body | Highest (when not `"default"`) |
| `OLLAMA_MODEL` in `.env.local` | Second |
| `config/models.json` → `ollama.default` | Fallback (`llava:7b`) |

Both `lib/describe-route.ts` and `lib/ollama.ts` resolve through `getDefaultOllamaModel()` from `lib/models.ts`. Vision model registry (alternates like `qwen3-vl:8b`) is in `config/models.json`.

### ComfyUI memory

| Mode | When |
|------|------|
| `--cpu` | macOS default (via startup scripts) |
| `--lowvram` / `--novram` | CUDA, limited VRAM |
| `--normalvram` | CUDA, sufficient VRAM |

Set `COMFYUI_MEMORY_MODE` in `.env.local`.

## `config/models.json`

Ollama registry: default model name plus metadata for optional vision models.

```json
{
  "ollama": {
    "default": "llava:7b",
    "vision": { "...": "..." }
  }
}
```

Read at runtime by `lib/models.ts` (`getDefaultOllamaModel`, `isValidVisionModel`).

Pull the default model: `npm run setup:ollama`.

## Configure UI → `ComfyUIConfig`

Form state: `lib/config-form.ts` + `lib/use-config-selector-form.ts`. Defaults from `/api/comfyui/config` via `lib/config-defaults.ts`. Submitted config built by `lib/config-process.ts`.

Passed to `/api/comfyui/process` as `config`:

| Field | Notes |
|-------|-------|
| `description` | From describe step (editable in UI) |
| `checkpoint` | `Flux` or SD `.safetensors` name |
| `steps`, `cfgScale`, `denoiseStrength` | Flux or SD defaults from config API |
| `sampler`, `scheduler` | SD only |
| `negativePrompt` | SD advanced; default blocks people/animals/faces (`lib/comfyui-defaults.ts`) |
| `hiresFix`, `hiresFactor`, `hiresDenoise` | SD hi-res pass (`lib/comfyui-workflow-sd-hires.ts`) |
| `controlNet`, `controlNetStrength` | SD ControlNet Tile |
| `freeU`, `qualityBoost` | SD extras |

Flux Fast/Slow is resolved client-side to the correct GGUF filename before submit.

## Prompt limits

`lib/prompt-limits.ts`: describe stream stops at ~220 words or 80 comma-separated tags. Applied in `lib/describe-route.ts` after Ollama returns text.

## Describe prompts

Edit `buildDescribePrompt()` in `lib/describe-route.ts`. There is no Ollama modelfile in this project.
