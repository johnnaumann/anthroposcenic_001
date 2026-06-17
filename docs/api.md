# API

All routes are under the Next.js app (`localhost:3000`). Streaming routes use Server-Sent Events (`text/event-stream`) unless noted.

## Upload and images

| Route | Method | Description |
|-------|--------|-------------|
| `/api/upload` | POST | Multipart upload; returns `imageId`, `imageUrl` |
| `/api/images/[imageId]` | GET | Serve uploaded source image |
| `/api/images/[imageId]` | DELETE | Remove uploaded image |

## Describe

| Route | Method | Description |
|-------|--------|-------------|
| `/api/describe` | POST | Body: `{ imageId }` or `{ imageIds: string[] }`. SSE `token` + `done` |

## ComfyUI

| Route | Method | Description |
|-------|--------|-------------|
| `/api/comfyui/config` | GET | Checkpoints, samplers, schedulers, Flux fast/slow filenames, defaults |
| `/api/comfyui/samplers` | GET | List sampler names from a running ComfyUI instance |
| `/api/comfyui/process` | POST | Body: `{ imageId, config, useImage?, width?, height? }`. SSE progress and result |
| `/api/comfyui/process/result` | GET | Query: `promptId`, `since`. Resolve output image after stream drop |
| `/api/comfyui/output` | GET | Query: `filename`, optional `download=1`. Proxy `comfyui/output/` file |

## Archive

| Route | Method | Description |
|-------|--------|-------------|
| `/api/outputs` | GET | List `anthroposcenic_*` outputs (newest first) |
| `/api/outputs` | DELETE | Query: `filename`. Delete from `comfyui/output/` |
| `/api/outputs/image/[filename]` | GET | Serve archive thumbnail; query `v` for cache bust, `download=1` for attachment |
| `/api/outputs/use` | POST | Body: `{ filename }`. Copy output into `uploads/`; returns new `imageId` |

## SSE message shapes (process / describe)

Common fields:

```json
{ "type": "status", "data": "string" }
{ "type": "progress", "data": { "overall": 42, "phaseLabel": "..." } }
{ "type": "meta", "data": { "promptId": "...", "jobStartTime": 1234567890 } }
{ "type": "image", "data": "/api/comfyui/output?filename=..." }
{ "type": "done" }
{ "type": "error", "error": "message" }
```
