# Anthroposcenic

Local image pipeline: upload an image, generate a prompt with Ollama, configure ComfyUI settings, and render a reinterpretation.

## Stack

| Layer | Technology | Port |
|-------|------------|------|
| App | Next.js 14 (App Router), React 18, TypeScript | 3000 |
| UI | Tailwind CSS v4, ShadCN v4 (Radix Nova), Geist, Sonner | — |
| Vision / prompts | Ollama — `llava:7b` (default) | 11434 |
| Image generation | ComfyUI — Flux GGUF (default) or SD checkpoints | 8188 |
| Progress | ComfyUI WebSocket + HTTP poll; SSE to browser | — |
| Images | Sharp (upload resize), `next/image` | — |
| Storage | `./uploads`, `comfyui/output` | — |

```mermaid
flowchart TB
    subgraph app["Next.js :3000"]
        UI[App Router pages]
        API[Thin route handlers]
        LIB[lib/ business logic]
    end

    subgraph ollama["Ollama :11434"]
        VM[llava:7b]
    end

    subgraph comfy["ComfyUI :8188"]
        WF[Programmatic workflows]
        OUT[(comfyui/output/)]
    end

    UP[(uploads/)]

    UI --> API
    API --> LIB
    LIB -->|SSE describe| VM
    LIB -->|WS + SSE process| WF
    LIB --> UP
    WF --> OUT
    LIB --> OUT

    style app fill:#404040,stroke:#262626,color:#ffffff
    style ollama fill:#525252,stroke:#404040,color:#ffffff
    style comfy fill:#737373,stroke:#525252,color:#ffffff
    style UI fill:#262626,stroke:#0a0a0a,color:#ffffff
    style API fill:#262626,stroke:#0a0a0a,color:#ffffff
    style LIB fill:#262626,stroke:#0a0a0a,color:#ffffff
    style VM fill:#262626,stroke:#0a0a0a,color:#ffffff
    style WF fill:#262626,stroke:#0a0a0a,color:#ffffff
    style UP fill:#262626,stroke:#0a0a0a,color:#ffffff
    style OUT fill:#262626,stroke:#0a0a0a,color:#ffffff
```

**UI flow:** `/` → `/upload` → `/describe` → `/configure` → `/process` → `/complete` · `/archive` for past renders and blend

`npm run dev` starts **Ollama + Next.js only**. ComfyUI starts on demand when processing.

API routes under `app/api/` delegate to `lib/` (see [docs/development.md](docs/development.md)).

## Quick setup

**Requirements:** Node.js 18+, Python 3.10+, 16GB+ RAM, ~20GB disk for models.

```bash
git clone https://github.com/yourusername/anthroposcenic.git
cd anthroposcenic
npm install
```

**Ollama**

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

```bash
npm run setup    # pull llava:7b + ComfyUI + Flux
```

Optional Stable Diffusion stack:

```bash
npm run comfyui:sd
```

**Run**

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| Ollama | http://localhost:11434 |
| ComfyUI | http://localhost:8188 (on first process) |

Optional: `.env.local` — see [docs/configuration.md](docs/configuration.md).

## Documentation

| Document | Contents |
|----------|----------|
| [architecture.md](docs/architecture.md) | Pipeline, routes, code layout, streaming, storage |
| [development.md](docs/development.md) | Full `lib/` module map and conventions |
| [models.md](docs/models.md) | Ollama vision model, ComfyUI model setup |
| [configuration.md](docs/configuration.md) | Environment variables, config files |
| [api.md](docs/api.md) | HTTP routes and SSE shapes |
| [scripts.md](docs/scripts.md) | `npm run` reference |
| [troubleshooting.md](docs/troubleshooting.md) | Common failures |
| [testing.md](docs/testing.md) | Manual test checklist (single + blend) |

## License

See [LICENSE](./LICENSE).
