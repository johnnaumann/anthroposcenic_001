# Testing

Manual checklist for the full pipeline. Run `npm run dev` and ensure Ollama is up; ComfyUI starts on first process.

## Prerequisites

```bash
npm run setup:ollama
ollama list | grep llava

ls comfyui/models/unet/*flux* 2>/dev/null || ls comfyui/models/checkpoints/*.safetensors 2>/dev/null
```

## Single-image pipeline

| Step | Action | Expected |
|------|--------|----------|
| Upload | Drop a PNG/JPG on `/upload` | Redirect to `/describe?imageId=...` |
| Describe | Wait for stream | Prompt text fills textarea; word count shown |
| Configure | Adjust model/settings, Continue | Navigate to `/process?imageId=...` |
| Process | Auto-starts | Progress bar advances; no false error if image exists on disk |
| Complete | Finish | Text completion message; download / archive / reinterpret |
| Archive | Open `/archive` | Grid of uploads + outputs; Use / Download / Delete work |

## Blend pipeline

| Step | Action | Expected |
|------|--------|----------|
| Archive | Select 2+ images, Blend | Navigate to `/describe?imageIds=a,b,...` |
| Describe | Wait for stream | Fusion-style prompt (multi-image wording) |
| Configure | Continue | `/configure?mode=blend` |
| Process | Auto-starts | txt2img (`useImage: false`); no source image required |
| Complete | Finish | New output in archive |

Blend UI: `components/OutputArchiveGrid.tsx`, hook `lib/use-output-archive-grid.ts`.

## API smoke tests

```bash
# Ollama
curl -s http://localhost:11434/api/tags | head

# ComfyUI config (app must be running)
curl -s http://localhost:3000/api/comfyui/config | jq '.checkpoints | length'

# Archive list
curl -s http://localhost:3000/api/outputs | jq '.images | length'
```

## Describe endpoint

```bash
# After upload, replace IMAGE_ID
curl -N -X POST http://localhost:3000/api/describe \
  -H "Content-Type: application/json" \
  -d '{"imageId":"IMAGE_ID"}'
```

Expect SSE `token` events and a final `done`.

Blend:

```bash
curl -N -X POST http://localhost:3000/api/describe \
  -H "Content-Type: application/json" \
  -d '{"imageIds":["ID_A","ID_B"]}'
```

## Common failures

| Symptom | Check |
|---------|-------|
| Describe hangs | Model loading; watch `ollama ps` |
| Empty describe output | `llava:7b` installed; `OLLAMA_HOST`; logs in `lib/describe-route.ts` |
| Process 0% forever | ComfyUI not reachable on `:8188`; `lib/comfyui-startup.ts` |
| Try again with file on disk | SSE recovery; see [troubleshooting.md](troubleshooting.md) |
| Checkpoint error | Model file in `checkpoints/` or run `npm run setup:comfyui` |
