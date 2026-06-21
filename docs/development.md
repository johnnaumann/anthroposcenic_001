# Development

Guide for working in the Anthroposcenic codebase after the lib/ refactor. Prefer these docs over stale inline comments.

## Project layout

```
app/
  page.tsx                      # redirect to /upload
  upload/ describe/ configure/ process/ complete/ archive/
  api/
    upload/route.ts               # multipart upload
    describe/route.ts             # thin SSE → lib/describe-route.ts
    images/[imageId]/route.ts     # serve / delete uploads
    comfyui/
      config/route.ts             # checkpoints, samplers, defaults
      samplers/route.ts
      process/route.ts            # thin SSE → lib/comfyui-process-route.ts
      process/result/route.ts     # recovery poll
      output/route.ts             # proxy comfyui/output/
    outputs/
      route.ts                    # list / delete archive
      use/route.ts                # copy output → uploads/
      image/[filename]/route.ts   # serve archive thumbnail

components/
  PageShell.tsx                   # layout shell
  ImageUploadZone.tsx
  DescriptionStream.tsx           # describe SSE + inline edit
  ConfigSelector.tsx              # Flux Fast/Slow or SD controls
  ComfyUIProgress.tsx             # process SSE + recovery
  OutputArchiveGrid.tsx           # archive grid + blend selection
  ui/                             # ShadCN v4 primitives

lib/
  # — API route handlers (called from app/api) —
  describe-route.ts               # describe SSE: prompts, Ollama, cleanup
  comfyui-process-route.ts        # process SSE: queue, poll, emit image

  # — Ollama —
  ollama.ts                       # generate API, model resolution
  ollama-stream.ts                # token stream parsing
  models.ts                       # reads config/models.json

  # — ComfyUI core —
  comfyui.ts                      # availability, queue, find output
  comfyui-helpers.ts              # host URL, object_info, samplers
  comfyui-startup.ts              # spawn ComfyUI on demand
  comfyui-defaults.ts             # negative prompt defaults
  comfyui-output.ts               # output filename helpers

  # — Workflows —
  comfyui-workflow.ts             # createComfyUIWorkflow, Flux path
  comfyui-workflow-sd.ts          # SD img2img / txt2img graph
  comfyui-workflow-sd-hires.ts    # SD hi-res refine branch
  comfyui-workflow-types.ts       # ComfyUIWorkflow type

  # — Progress / poll —
  comfyui-poll.ts                 # WS then HTTP orchestration
  comfyui-poll-ws.ts
  comfyui-poll-http.ts
  comfyui-poll-api.ts
  comfyui-poll-history.ts
  comfyui-poll-output.ts
  comfyui-ws.ts
  comfyui-ws-message.ts
  comfyui-process-stream.ts       # client-side SSE subscription + recovery
  processing-progress.ts          # phased progress labels

  # — Configure UI helpers —
  config-form.ts                  # form shape, Flux detection
  config-defaults.ts              # merge API defaults
  config-process.ts               # form → ComfyUIConfig
  use-config-selector-form.ts

  # — Upload / images —
  image-processing.ts             # Sharp resize + compress
  upload-images.ts                # find upload by imageId
  project-paths.ts                # UPLOAD_DIR resolution

  # — Archive —
  output-archive.ts               # list, delete, copy, filename safety
  output-archive-client.ts        # client fetch helpers
  serve-output-image.ts           # ETag, cache headers
  archive-utils.ts
  archive-display.ts
  use-output-archive-grid.ts

  # — Pipeline state (sessionStorage) —
  pipeline-storage.ts             # re-exports + clearPipelineState
  pipeline-description.ts
  pipeline-config.ts

  # — Shared —
  streaming.ts                    # SSE format, readFetchSSEStream
  prompt-limits.ts                # describe length cap
  model-downloader.ts             # SD checkpoint auto-download
  utils.ts

config/
  models.json                     # Ollama default (llava:7b) + vision registry

types/
  index.ts                        # shared API / domain types

comfyui/                          # local ComfyUI install (gitignored models)
scripts/                          # setup and diagnostics shell scripts
```

## Conventions

### Thin API routes

Streaming routes follow the same pattern:

```typescript
// app/api/describe/route.ts (representative)
void runDescribeStream(request, controller);
return new Response(stream, { headers: DESCRIBE_SSE_HEADERS });
```

Add new logic in `lib/`, not in `route.ts`, unless the change is purely HTTP wiring.

### Streaming

- Server: `lib/streaming.ts` — `sendStreamMessage`, `sendStreamError`, `closeStream`
- Client: `readFetchSSEStream`, `parseSSEDataLine` from the same module
- Process jobs: `lib/comfyui-process-stream.ts` deduplicates concurrent listeners; unsubscribing must not cancel the ComfyUI job

### Types

Shared request/response shapes live in `types/index.ts`. Import from `@/types` in both routes and components.

### Styling

- Tailwind CSS v4 — `app/globals.css` (theme tokens); base styles on `app/layout.tsx`
- ShadCN v4 / Radix Nova in `components/ui/`
- Geist Sans + Mono via `geist`
- Grayscale-only palette (see `.cursor/rules/monotone-design.mdc`)
- Dark mode default; toasts via Sonner

## Common tasks

| Task | Where to change |
|------|-----------------|
| Describe prompt wording | `buildDescribePrompt()` in `lib/describe-route.ts` |
| Ollama model default | `config/models.json` and/or `OLLAMA_MODEL` |
| Flux workflow nodes | `lib/comfyui-workflow.ts` |
| SD workflow / hi-res | `lib/comfyui-workflow-sd.ts`, `lib/comfyui-workflow-sd-hires.ts` |
| Configure form fields | `lib/config-form.ts`, `components/ConfigSelector.tsx` |
| Archive listing rules | `lib/output-archive.ts` |
| SD checkpoint downloads | `lib/model-downloader.ts` |

## Local dev

```bash
npm run dev          # Ollama + Next.js + open browser
npm run lint
npx tsc --noEmit
```

ComfyUI is not started by `dev`; it launches on first process request or via `npm run comfyui:run`.
