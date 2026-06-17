# Troubleshooting

## Ports and processes

```bash
lsof -i :3000    # Next.js
lsof -i :11434   # Ollama
lsof -i :8188    # ComfyUI

pkill ollama
pkill -f "python.*main.py"
```

## Ollama

```bash
npm run ollama:check
ollama list
ollama pull qwen3-vl:8b
npm run ollama:modelfile
```

Describe stream ends with no text: confirm the model exists (`ollama list`) and Ollama is running on `OLLAMA_HOST`.

## ComfyUI not starting

```bash
npm run comfyui:setup
npm run comfyui:run
```

Python dependency errors:

```bash
cd comfyui
./venv/bin/pip install -r requirements.txt
```

## No checkpoint / empty model list

SD models must live in `comfyui/models/checkpoints/`.

```bash
cd comfyui/models/checkpoints
curl -L -o sd-v1-5.safetensors \
  https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors
```

Or run `npm run comfyui:download-all` / `npm run comfyui:flux` for Flux.

Corrupted checkpoint: delete the file from `checkpoints/` and re-run; the process route can trigger a re-download.

## Processing timeout or false failure

Symptoms: UI shows "Try again" but `comfyui/output/anthroposcenic_*.png` exists.

- Check server log for `Attempted to send message to closed stream`
- Client recovery polls `/api/comfyui/process/result` — ensure `meta` event with `promptId` was received
- Restart dev server after code changes to `lib/comfyui-process-stream.ts`

## Out of memory

macOS: ComfyUI runs with `--cpu` and split cross-attention by default.

CUDA: try `COMFYUI_MEMORY_MODE=--lowvram` in `.env.local`.

Reduce steps, disable hi-res, or use Flux schnell (Fast) instead of dev (Slow).

## Samplers missing

```bash
npm run comfyui:samplers
npm run comfyui:install-all-samplers
```

Restart ComfyUI after installing custom nodes.

## Archive shows wrong thumbnails

Hard-refresh the browser. Archive images are served from `/api/outputs/image/[filename]?v={mtime}` with `no-cache` ETags — stale tabs may need a reload after fixes.
