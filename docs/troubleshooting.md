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
bash scripts/check-ollama.sh
ollama list
npm run setup:ollama    # pulls llava:7b
```

Describe stream ends with no text: confirm `llava:7b` is installed (`ollama list`) and Ollama is running on `OLLAMA_HOST`.

If setup-comfyui fails mid-way, the script removes the incomplete `comfyui/` directory. Re-run with `FORCE=1 npm run setup:comfyui` if a partial install remains.

Optional alternate vision model:

```bash
ollama pull qwen3-vl:8b
# OLLAMA_MODEL=qwen3-vl:8b in .env.local
```

Describe prompt format is in `lib/describe-route.ts` (`buildDescribePrompt`), not an Ollama modelfile.

If you still have a legacy `anthroposcenic-describe:latest` tag from an older setup, it is unused — safe to remove with `ollama rm anthroposcenic-describe:latest`.

## ComfyUI not starting

```bash
npm run setup:comfyui
npm run comfyui:run
```

Startup logic: `lib/comfyui-startup.ts`. Process handler: `lib/comfyui-process-route.ts`.

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

Or run `npm run comfyui:sd` / `npm run setup:comfyui` for Flux.

Corrupted checkpoint: delete the file from `checkpoints/` and re-run; `lib/model-downloader.ts` can trigger a re-download during process.

## Processing timeout or false failure

Symptoms: UI shows "Try again" but `comfyui/output/anthroposcenic_*.png` exists.

- Check server log for `Attempted to send message to closed stream`
- Client recovery polls `/api/comfyui/process/result` — ensure `meta` event with `promptId` was received
- Recovery logic: `lib/comfyui-process-stream.ts`; poll chain: `lib/comfyui-poll.ts`
- Restart dev server after code changes to process streaming modules

## Out of memory

macOS: ComfyUI runs with `--cpu` and split cross-attention by default.

CUDA: try `COMFYUI_MEMORY_MODE=--lowvram` in `.env.local`.

Reduce steps, disable hi-res, or use Flux schnell (Fast) instead of dev (Slow).

Before describe, the app calls ComfyUI `/free` to unload models (best-effort, `lib/describe-route.ts`).

## Samplers missing

```bash
bash scripts/check-comfyui-samplers.sh
bash scripts/install-all-samplers.sh
```

Restart ComfyUI after installing custom nodes.

## Archive shows wrong thumbnails

Hard-refresh the browser. Archive images are served from `/api/outputs/image/[filename]?v={mtime}` with ETag handling in `lib/serve-output-image.ts` — stale tabs may need a reload.

## Upload not found during describe/process

Uploads are resolved by UUID via `lib/upload-images.ts` under `uploads/`. Confirm the file exists and `imageId` in the URL matches.
