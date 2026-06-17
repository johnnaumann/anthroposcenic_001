# Testing

Manual checklist for the full pipeline. Run `npm run dev` and ensure Ollama is up; ComfyUI starts on first process.

## Prerequisites

```bash
npm run ollama:modelfile
ollama list | grep anthroposcenic-describe

ls comfyui/models/unet/*flux* 2>/dev/null || ls comfyui/models/checkpoints/*.safetensors 2>/dev/null
```

After modelfile edits:

```bash
npm run ollama:modelfile
```

## Pipeline

| Step | Action | Expected |
|------|--------|----------|
| Upload | Drop a PNG/JPG on `/upload` | Redirect to `/describe?imageId=...` |
| Describe | Wait for stream | Prompt text fills textarea; word count shown |
| Configure | Adjust model/settings, Continue | Navigate to `/process` |
| Process | Auto-starts | Progress bar advances; no false error if image exists on disk |
| Complete | Finish | Text completion message; download / archive / reinterpret |
| Archive | Open `/archive` | Masonry grid of outputs; Use / Download / Delete work |

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

## Common failures

| Symptom | Check |
|---------|-------|
| Describe hangs | Model loading; watch `ollama ps` |
| Process 0% forever | ComfyUI not reachable on `:8188` |
| Try again with file on disk | SSE recovery; see [troubleshooting.md](troubleshooting.md) |
| Checkpoint error | Model file in `checkpoints/` or run `comfyui:flux` |
