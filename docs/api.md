# API

All routes are served by Next.js at `http://localhost:3000`. Streaming routes use Server-Sent Events (`text/event-stream`).

Route files under `app/api/` are thin wrappers; implementation lives in `lib/` (see [development.md](development.md)).

## Upload and images

| Route | Method | Description |
|-------|--------|-------------|
| `/api/upload` | POST | Multipart field `file`. Returns `UploadResponse` (`imageId`, `imageUrl`, …). Sharp processing via `lib/image-processing.ts`. |
| `/api/images/[imageId]` | GET | Serve uploaded source. Query `download=1` for attachment. |
| `/api/images/[imageId]` | DELETE | Remove upload from `uploads/` |

## Describe

| Route | Method | Description |
|-------|--------|-------------|
| `/api/describe` | POST | SSE stream. Handler: `lib/describe-route.ts` |

**Body (JSON):**

```json
{ "imageId": "uuid" }
```

Blend (multi-image fusion prompt):

```json
{ "imageIds": ["uuid-a", "uuid-b"] }
```

Optional model override:

```json
{ "imageId": "uuid", "model": "qwen3-vl:8b" }
```

**SSE events:**

```json
{ "type": "token", "data": "partial text" }
{ "type": "done", "data": "final cleaned prompt" }
{ "type": "error", "error": "message" }
```

Before Ollama, the handler best-effort calls ComfyUI `POST /free` to unload GPU memory.

## ComfyUI

| Route | Method | Description |
|-------|--------|-------------|
| `/api/comfyui/config` | GET | Checkpoints, samplers, schedulers, Flux fast/slow filenames, defaults |
| `/api/comfyui/samplers` | GET | Sampler names from a running ComfyUI instance |
| `/api/comfyui/process` | POST | SSE progress and result. Handler: `lib/comfyui-process-route.ts` |
| `/api/comfyui/process/result` | GET | Query: `promptId`, `since`. Resolve output after SSE drop |
| `/api/comfyui/output` | GET | Query: `filename`, optional `download=1`. Proxy `comfyui/output/` |

**Process body (JSON):**

```json
{
  "imageId": "uuid",
  "config": { "description": "...", "checkpoint": "Flux", "steps": 20, "...": "..." },
  "useImage": true,
  "width": 768,
  "height": 1344
}
```

Blend / txt2img omits `imageId` and sets `useImage: false`. Config shape: `ComfyUIConfig` in `types/index.ts`.

## Archive

| Route | Method | Description |
|-------|--------|-------------|
| `/api/outputs` | GET | List uploads + `anthroposcenic_*` outputs (newest first). `lib/output-archive.ts` |
| `/api/outputs` | DELETE | Delete one entry. Query: `kind=generated&filename=…` or `kind=upload&imageId=…` |
| `/api/outputs/image/[filename]` | GET | Serve archive image. Query `v` for cache bust, `download=1` for attachment |
| `/api/outputs/use` | POST | Body: `{ "filename" }`. Copy generated output into `uploads/`; returns new `imageId` |

## SSE message shapes (process)

```json
{ "type": "status", "data": "string" }
{ "type": "progress", "data": { "overall": 42, "phaseLabel": "...", "phaseIndex": 0, "phaseCount": 2 } }
{ "type": "meta", "data": { "promptId": "...", "jobStartTime": 1234567890 } }
{ "type": "image", "data": "/api/comfyui/output?filename=..." }
{ "type": "done" }
{ "type": "error", "error": "message" }
```

Client recovery: if SSE closes before `done`, poll `/api/comfyui/process/result` using `meta.promptId` and `meta.jobStartTime`. Implemented in `lib/comfyui-process-stream.ts`.
