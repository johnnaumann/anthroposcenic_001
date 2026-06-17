# Configuration

## Environment variables

Create `.env.local` in the project root. All optional unless you need overrides.

```env
# Ollama
OLLAMA_HOST=http://localhost:11434
# OLLAMA_MODEL=anthroposcenic-describe:latest

# ComfyUI
COMFYUI_HOST=http://localhost:8188
COMFYUI_WS_URL=ws://localhost:8188/ws
# COMFYUI_MEMORY_MODE=--cpu

# Upload / storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Upload compression (Sharp)
MAX_IMAGE_WIDTH=1024
MAX_IMAGE_HEIGHT=1024
JPEG_QUALITY=85
PNG_QUALITY=90
WEBP_QUALITY=85
```

Default Ollama model comes from `config/models.json` (`anthroposcenic-describe:latest`), not from a required env var.

### ComfyUI memory

| Mode | When |
|------|------|
| `--cpu` | macOS default (via startup scripts) |
| `--lowvram` / `--novram` | CUDA, limited VRAM |
| `--normalvram` | CUDA, sufficient VRAM |

Set `COMFYUI_MEMORY_MODE` in `.env.local`.

## `config/models.json`

Ollama registry. App default:

```json
{
  "ollama": {
    "default": "anthroposcenic-describe:latest"
  }
}
```

## Configure UI → `ComfyUIConfig`

Passed to `/api/comfyui/process`:

| Field | Notes |
|-------|-------|
| `description` | From describe step (editable) |
| `checkpoint` | `Flux` or SD `.safetensors` name |
| `steps`, `cfgScale`, `denoiseStrength` | SD or Flux-specific defaults |
| `sampler`, `scheduler` | SD only |
| `negativePrompt` | SD advanced; default blocks people/animals/faces |
| `hiresFix`, `hiresFactor`, `hiresDenoise` | SD hi-res pass |
| `controlNet`, `controlNetStrength` | SD ControlNet Tile |
| `freeU`, `qualityBoost` | SD extras |

Flux Fast/Slow is resolved client-side to the correct GGUF filename before submit.

## Prompt limits

`lib/prompt-limits.ts`: describe stream stops at ~220 words or 80 comma-separated tags.
