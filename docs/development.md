# Development

## Project layout

```
app/
  page.tsx                 # redirects to /upload
  upload/ describe/ configure/ process/ complete/ archive/
  api/
    upload/ describe/
    images/[imageId]/
    comfyui/ process/ process/result/ config/ output/ samplers/
    outputs/ outputs/image/[filename]/ outputs/use/
components/
  PageShell.tsx            # layout; optional card (archive loading)
  ThemeToggle.tsx
  ImageUploadZone.tsx
  DescriptionStream.tsx    # describe SSE + inline edit
  ConfigSelector.tsx       # Flux Fast/Slow or SD controls
  ComfyUIProgress.tsx      # process SSE
  OutputArchiveGrid.tsx    # masonry archive
  ui/                      # ShadCN v4 primitives
lib/
  ollama.ts
  comfyui.ts               # workflows, poll, filesystem fallback
  comfyui-ws.ts
  comfyui-startup.ts
  comfyui-process-stream.ts
  output-archive.ts
  serve-output-image.ts
  pipeline-storage.ts      # sessionStorage
  processing-progress.ts
  prompt-limits.ts
  model-downloader.ts
config/
  models.json
  ollama-modelfile
comfyui/                   # local ComfyUI install
scripts/
```

## Styling

- Tailwind CSS v4 (`@import "tailwindcss"` in `app/globals.css`)
- ShadCN v4 / Radix Nova components
- Geist Sans + Mono via `geist` package
- Grayscale-only palette (no accent colours)
- Dark mode default (`ThemeProvider` in `app/layout.tsx`)
- Toasts via Sonner

## Client state

| Data | Where |
|------|-------|
| Prompt text | `sessionStorage` (`pipeline-storage.ts`) |
| ComfyUI config | `sessionStorage` |
| `imageId` | URL query between steps |

## Progress and recovery

1. Server: WebSocket (`comfyui-ws.ts`) then HTTP poll
2. `processing-progress.ts`: phased labels for base + hi-res
3. Client: `comfyui-process-stream.ts` shared subscription; `/api/comfyui/process/result` recovery if SSE closes early

## Workflow code

`createComfyUIWorkflow()` in `lib/comfyui.ts` — Flux GGUF path vs SD checkpoint path; optional hi-res, ControlNet, FreeU.
