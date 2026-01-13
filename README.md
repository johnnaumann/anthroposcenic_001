# Anthroposcenic

**A 100% local, privacy-first AI image processing pipeline.**

Upload an image → Generate AI description → Process with ComfyUI → All on your machine.

```mermaid
flowchart LR
    A[Upload Image] --> B[Ollama]
    B --> C[Stream Description]
    C --> D[ComfyUI]
    D --> E[Processed Image]
    
    style A fill:#404040,stroke:#262626,color:#ffffff
    style B fill:#525252,stroke:#404040,color:#ffffff
    style C fill:#737373,stroke:#525252,color:#ffffff
    style D fill:#a3a3a3,stroke:#737373,color:#000000
    style E fill:#d4d4d4,stroke:#a3a3a3,color:#000000
```

## Why Local?

- **Privacy**: Images never leave your machine
- **Free**: No API costs or rate limits  
- **Offline**: Works without internet (after setup)
- **Fast**: No network latency
- **Control**: Full customization of models and workflows

---

## Architecture

```mermaid
graph TB
    subgraph local["Your Local Machine"]
        subgraph app["Next.js App :3000"]
            UI[Web Interface]
            API[API Routes]
        end
        
        subgraph ollama["Ollama :11434"]
            VM[Vision Model<br/>qwen3-vl:8b]
        end
        
        subgraph comfy["ComfyUI :8188"]
            SD[Stable Diffusion<br/>Models]
            WF[Programmatic<br/>Workflows]
        end
        
        FS[(Local Storage<br/>./uploads)]
    end
    
    UI --> API
    API --> ollama
    API --> comfy
    API --> FS
    
    style local fill:#404040,stroke:#262626,color:#ffffff
    style app fill:#525252,stroke:#404040,color:#ffffff
    style ollama fill:#737373,stroke:#525252,color:#ffffff
    style comfy fill:#a3a3a3,stroke:#737373,color:#000000
    style UI fill:#262626,stroke:#0a0a0a,color:#ffffff
    style API fill:#262626,stroke:#0a0a0a,color:#ffffff
    style VM fill:#262626,stroke:#0a0a0a,color:#ffffff
    style SD fill:#262626,stroke:#0a0a0a,color:#ffffff
    style WF fill:#262626,stroke:#0a0a0a,color:#ffffff
    style FS fill:#262626,stroke:#0a0a0a,color:#ffffff
```

**All communication via `localhost` — zero external calls.**

---

## Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 18+ | Next.js app |
| Python | 3.10+ | ComfyUI |
| RAM | 16GB+ | AI models |
| Storage | 20GB+ | Models & images |

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/anthroposcenic.git
cd anthroposcenic
npm install
```

### 2. Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:** Download from [ollama.com/download](https://ollama.com/download)

### 3. Install Vision Models & Create Custom Model

```bash
npm run ollama:models
```

This installs the base vision model (`llava:7b`) and creates a custom model (`anthroposcenic-describe:latest`) with an optimized system prompt for image description.

**Or manually:**
```bash
# Install base model
ollama pull llava:7b

# Create custom model with system prompt
npm run ollama:modelfile
```

The custom model includes a system prompt optimized for generating detailed image descriptions suitable for AI image generation systems.

### 4. Setup ComfyUI

```bash
npm run comfyui:setup
```

This clones ComfyUI, creates a Python venv, and installs dependencies.

### 5. Download SD Model (Required)

**Note: ComfyUI requires a Stable Diffusion checkpoint to process images.**

Download a checkpoint model to:

```
comfyui/models/checkpoints/
```

**Recommended models:**
- **Stable Diffusion 1.5** (~4GB): [Hugging Face](https://huggingface.co/runwayml/stable-diffusion-v1-5)
- **SDXL** (~7GB): [Hugging Face](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)
- **Community models**: [Civitai](https://civitai.com)

**File formats:** `.safetensors` or `.ckpt`

**Quick download (SD 1.5):**
```bash
cd comfyui/models/checkpoints
curl -L -o sd-v1-5.safetensors https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors
```

### 6. Start Application

```bash
npm run dev
```

This starts Ollama and Next.js, then opens your browser:

| Service | URL | Status |
|---------|-----|--------|
| Next.js | http://localhost:3000 | App |
| Ollama | http://localhost:11434 | AI |

**Note:** ComfyUI starts automatically when you process an image (after description is generated).

---

## How It Works

```mermaid
sequenceDiagram
    participant U as User
    participant N as Next.js
    participant O as Ollama
    participant C as ComfyUI
    
    U->>N: Upload Image
    N->>N: Store locally
    N->>O: Send image for analysis
    O-->>N: Stream JSON (description + config)
    N-->>U: Display description & config
    N->>N: Start ComfyUI (if needed)
    N->>N: Download model (if missing)
    N->>C: Send image + config
    C->>C: Process (img2img)
    C-->>N: Stream progress
    N-->>U: Display result
    
    Note over U: User Interface
    Note over N: Next.js Server
    Note over O: Ollama AI
    Note over C: ComfyUI Processing
```

### Pipeline Steps

1. **Upload** — Image saved to `./uploads/`
2. **Analyze** — Ollama vision model analyzes image and generates:
   - Detailed visual description
   - Optimal ComfyUI configuration (model, sampler, steps, CFG, denoise, etc.)
   - Returns JSON with all settings
3. **Start ComfyUI** — ComfyUI starts automatically with the specified configuration
4. **Download Models** — If the specified model isn't installed, it downloads automatically
5. **Process** — ComfyUI runs img2img workflow using the generated configuration
6. **Result** — Processed image streamed back to browser

---

## Configuration

### How It Works

The application uses **AI-generated configuration** from Ollama. When you upload an image:

1. Ollama analyzes the image and generates a JSON response containing:
   - **description**: Detailed visual description
   - **checkpoint**: Recommended model (e.g., `Deliberate_v2.safetensors`)
   - **sampler**: Optimal sampler (e.g., `dpmpp_2m_karras`)
   - **scheduler**: Scheduler type (e.g., `normal`)
   - **steps**: Number of sampling steps (e.g., 32)
   - **cfgScale**: CFG scale value (e.g., 7.5)
   - **denoiseStrength**: Denoise strength (e.g., 0.45)
   - **negativePrompt**: Quality-focused negative prompt

2. The application automatically:
   - Starts ComfyUI if not running
   - Downloads the specified model if missing
   - Uses the generated configuration for processing

### Environment Variables (Optional Overrides)

You can still override settings in `.env.local` if needed:

```env
# Ollama (Local)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3-vl:8b

# ComfyUI (Local)
COMFYUI_HOST=http://localhost:8188
# Memory optimization: --lowvram, --novram, --cpu, or --normalvram (default)
# COMFYUI_MEMORY_MODE=--lowvram

# Note: Configuration is now AI-generated from Ollama based on image analysis
# These environment variables are optional overrides (not required)

# ComfyUI Creativity Settings (fallback if Ollama doesn't provide config)
# Preset: low, medium, high, extreme, quality, quality-high, vivid
# COMFYUI_CREATIVITY=vivid

# Advanced: Override individual parameters (optional, only used as fallback)
# COMFYUI_STEPS=35              # Sampling steps
# COMFYUI_CFG_SCALE=7.5          # CFG scale
# COMFYUI_DENOISE=0.45            # Denoise strength
# COMFYUI_SAMPLER=dpmpp_2m_karras # Sampler
# COMFYUI_SCHEDULER=karras        # Scheduler
# COMFYUI_CHECKPOINT=Deliberate_v2.safetensors # Model checkpoint

# Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Image Compression (automatic during upload)
MAX_IMAGE_WIDTH=1024      # Maximum width in pixels (preserves aspect ratio)
MAX_IMAGE_HEIGHT=1024     # Maximum height in pixels (preserves aspect ratio)
JPEG_QUALITY=85           # JPEG quality 1-100 (higher = better quality, larger file)
PNG_QUALITY=90            # PNG quality 1-100
WEBP_QUALITY=85           # WebP quality 1-100
```

### Model Configuration

Models are defined in `config/models.json`:

```json
{
  "ollama": {
    "default": "anthroposcenic-describe:latest",
    "vision": {
      "anthroposcenic-describe:latest": {
        "recommended": true,
        "baseModel": "llava:7b"
      },
      "llava:7b": { "recommended": false }
    }
  }
}
```

**Custom Model with System Prompt:**

The application uses a custom Ollama model (`anthroposcenic-describe:latest`) created from `config/ollama-modelfile`. This modelfile includes:

- **System Prompt**: Optimized to generate JSON with image description AND ComfyUI configuration
- **Base Model**: `llava:7b` (fast and reliable)
- **Parameters**: Temperature 0.5 (lower for more structured JSON), top_p 0.9, top_k 40
- **Output Format**: JSON with `description`, `checkpoint`, `sampler`, `scheduler`, `steps`, `cfgScale`, `denoiseStrength`, `negativePrompt`

**Create/Update the custom models:**
```bash
# Create/update the describe model (generates JSON with description + ComfyUI config)
npm run ollama:modelfile

# Create/update the transform model (transforms descriptions using scientific analogies)
npm run ollama:modelfile:transform
```

**CRITICAL:** After updating ANY modelfile, you MUST recreate the model for changes to take effect. The system prompts in modelfiles are baked into the model at creation time.

**Install all models:**
```bash
npm run ollama:models
```

**Edit the system prompt:**
Edit `config/ollama-modelfile` and recreate the model:
```bash
npm run ollama:modelfile
```

**Modelfile Structure:**

The `config/ollama-modelfile` defines the custom model:

```dockerfile
FROM llava:7b

SYSTEM """You are an expert image analysis assistant...
[System prompt for detailed image descriptions]
"""

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
```

You can customize:
- **FROM**: Base model (e.g., `llava:7b`, `llava:13b`, `qwen3-vl:8b`)
- **SYSTEM**: System prompt that guides the model's behavior
- **PARAMETER**: Generation parameters (temperature, top_p, top_k)

After editing, recreate the model:
```bash
npm run ollama:modelfile
```

---

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── upload/          # Image upload
│   │   ├── describe/        # Ollama streaming
│   │   ├── comfyui/         # ComfyUI processing
│   │   └── models/          # Model list
│   └── page.tsx             # Main UI
├── components/
│   ├── ui/                  # ShadCN components
│   ├── ImageUploadZone.tsx
│   ├── DescriptionStream.tsx
│   └── ComfyUIProgress.tsx
├── lib/
│   ├── ollama.ts            # Ollama client
│   ├── comfyui.ts           # ComfyUI client + workflow
│   └── models.ts            # Model utilities
├── comfyui/                 # ComfyUI installation
├── config/
│   ├── models.json          # Model definitions
│   └── ollama-modelfile     # Custom Ollama model with system prompt
└── scripts/
    ├── start-ollama.sh
    ├── start-comfyui.sh
    └── setup-comfyui.sh
```

---

## ComfyUI Workflow

The workflow is built **programmatically in code** — no UI required.

```mermaid
flowchart LR
    A[LoadImage] --> B[VAEEncode]
    C[CheckpointLoader] --> B
    C --> D[CLIPTextEncode+]
    C --> E[CLIPTextEncode-]
    B --> F[KSampler]
    D --> F
    E --> F
    F --> G[VAEDecode]
    G --> H[SaveImage]
    
    style A fill:#262626,stroke:#0a0a0a,color:#ffffff
    style B fill:#404040,stroke:#262626,color:#ffffff
    style C fill:#525252,stroke:#404040,color:#ffffff
    style D fill:#737373,stroke:#525252,color:#ffffff
    style E fill:#737373,stroke:#525252,color:#ffffff
    style F fill:#a3a3a3,stroke:#737373,color:#000000
    style G fill:#d4d4d4,stroke:#a3a3a3,color:#000000
    style H fill:#e5e5e5,stroke:#d4d4d4,color:#000000
```

Customize in `lib/comfyui.ts`:

```typescript
createComfyUIWorkflow(imageFilename, description, {
  // Creativity preset
  // 'vivid' = vivid, visually arresting images (default)
  // 'quality' or 'quality-high' = preserve detail, high quality
  // 'high' or 'extreme' = more variation, less replication
  creativity: 'vivid',
  
  // Or override individual parameters:
  checkpoint: 'model.safetensors',
  steps: 25,              // Sampling steps (15-30, higher = better quality)
  cfgScale: 6.0,         // CFG scale (5-8, lower = more creative, higher = more prompt adherence)
  denoiseStrength: 0.85, // Denoise (0.65-0.95, higher = more variation from input)
  sampler: 'dpmpp_2m_karras', // Sampler: euler, dpmpp_2m, dpmpp_2m_karras, euler_a
  scheduler: 'karras',    // Scheduler: normal, karras, exponential, simple
  negativePrompt: 'exact copy, identical, duplicate...', // Custom negative prompt
})
```

**Creativity Presets:**

**Vivid & Quality-Focused (Best for Visual Impact):**
- **`vivid`**: Vivid, visually arresting images with good detail (denoise: 0.45, CFG: 7.5, steps: 32) - **Default**
  - Optimized for photorealistic quality without artifacts
  - Balanced for quality and memory efficiency
  - Enhanced negative prompt for better contrast and saturation

**Detail Preservation (Maximum Quality):**
- **`quality`**: Preserve detail, high quality (denoise: 0.35, CFG: 8.0, steps: 35)
- **`quality-high`**: Maximum detail preservation (denoise: 0.30, CFG: 8.5, steps: 45)

**Variation-Focused (More Creative Changes):**
- **`low`**: Minimal variation, memory-optimized (denoise: 0.65, CFG: 8.0, steps: 15)
- **`medium`**: Moderate variation (denoise: 0.75, CFG: 7.0, steps: 18)
- **`high`**: High variation, good balance (denoise: 0.85, CFG: 6.0, steps: 22)
- **`extreme`**: Maximum variation (denoise: 0.95, CFG: 5.0, steps: 28)

**Key Parameters for Quality vs Creativity:**

**For Detail Preservation (Quality Mode):**
- **Denoise Strength** (0.25-0.35): Lower = preserves more original detail
- **CFG Scale** (7.0-9.0): Higher = better prompt adherence while preserving detail
- **Steps** (30-50): More steps = better refinement and detail
- **Sampler**: `dpmpp_2m` or `dpmpp_2m_karras` for high quality

**For Creative Variation:**
- **Denoise Strength** (0.65-0.95): Higher = more variation from input image
- **CFG Scale** (5-7): Lower = more creative freedom
- **Steps** (15-28): Fewer steps = faster, more variation
- **Sampler**: Automatically validated against available ComfyUI samplers with fallback

**Note:** Sampler names are automatically validated. If a requested sampler isn't available, the system will use a compatible fallback and log a warning.

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload image, returns `imageId` |
| `/api/describe` | POST | Stream description from Ollama |
| `/api/comfyui/process` | POST | Process with ComfyUI |
| `/api/comfyui/config` | GET | Get available ComfyUI configuration options (models, samplers, schedulers) |
| `/api/comfyui/samplers` | GET | List available ComfyUI samplers |
| `/api/images/[id]` | GET | Retrieve uploaded image |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all services + open browser |
| `npm run dev:next` | Start Next.js only |
| `npm run dev:ollama` | Start Ollama only |
| `npm run dev:comfyui` | Start ComfyUI only |
| `npm run comfyui:setup` | Install ComfyUI |
| `npm run comfyui:test-memory` | Test ComfyUI memory modes to find optimal settings |
| `npm run comfyui:samplers` | List all available ComfyUI samplers |
| `npm run comfyui:install-extra-samplers` | Install ComfyUI Extra Samplers plugin (adds more samplers) |
| `npm run comfyui:install-creative-models` | Install creative/artistic diffusion models (DreamShaper, Deliberate, etc.) |
| `npm run ollama:models` | Install recommended models + create custom model |
| `npm run ollama:modelfile` | Create/update custom model from modelfile |
| `npm run ollama:check` | Verify Ollama status |

---

## Troubleshooting

### Service Won't Start

```bash
# Check what's using ports
lsof -i :3000   # Next.js
lsof -i :11434  # Ollama
lsof -i :8188   # ComfyUI

# Kill stuck processes
pkill ollama
pkill -f "python.*main.py"
```

### Ollama Model Not Found

```bash
ollama list              # See installed models
ollama pull qwen3-vl:8b  # Re-download
```

### ComfyUI Processing Timeout / No Checkpoints

**Error:** `No checkpoint models available` or `ckpt_name: '' not in []`

**Solution:** Install a Stable Diffusion checkpoint:

```bash
# Navigate to checkpoints directory
cd comfyui/models/checkpoints

# Download SD 1.5 (recommended, ~4GB)
curl -L -o sd-v1-5.safetensors \
  https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors

# Verify it's there
ls -lh *.safetensors *.ckpt
```

**After installing:** Restart ComfyUI or the app will auto-detect on next request.

### ComfyUI Python Errors

```bash
cd comfyui
./venv/bin/pip install -r requirements.txt
```

### Installing All ComfyUI Samplers

ComfyUI comes with built-in samplers, but you can install comprehensive sampler packages to ensure all suggested samplers are available:

**Install All Sampler Packages (Recommended):**
```bash
npm run comfyui:install-all-samplers
```

This installs multiple sampler packages:
- **ComfyUI Extra Samplers** - Primary sampler extension with many additional samplers
- **ComfyUI HybridSamplers** - Hybrid sampler variants
- **ComfyUI Switch Samplers** - Dynamic sampler switching capabilities
- **ComfyUI Tiled KSampler** - Tiled sampling for large images (optional)

**Check Current Samplers:**
```bash
npm run comfyui:samplers
# Or via API: curl http://localhost:3000/api/comfyui/samplers
```

**Install Only Extra Samplers (Alternative):**
```bash
npm run comfyui:install-extra-samplers
```

**After Installation:**
1. Restart ComfyUI to load new samplers (or it will auto-load on next request)
2. Check available samplers: `npm run comfyui:samplers`
3. All new samplers will be automatically detected when Ollama suggests them

### Installing Creative/Artistic Diffusion Models

For more creative, surreal, and "weird" outputs, you can install specialized diffusion models:

**Install Creative Models:**
```bash
npm run comfyui:install-creative-models
```

This installs several creative models:
- **DreamShaper 8**: Dreamy, painterly, hyper-realistic with artistic flair
- **Deliberate v2**: Highly creative, excellent at following complex prompts
- **AbyssOrangeMix3**: Anime/artistic style, very creative
- **Anything V5**: Popular anime/artistic model
- **ChilloutMix**: Realistic but with artistic flair
- **Realistic Vision V5.1**: Photorealistic (can be pushed to creative)

**Using a Specific Model:**

1. **Via Environment Variable** (`.env.local`):
   ```env
   COMFYUI_CHECKPOINT=DreamShaper_8.safetensors
   ```

2. **Models are auto-detected**: After installation, restart ComfyUI and the app will automatically detect all available models.

**Finding More Models:**

- **Civitai**: https://civitai.com/models (huge collection of creative models)
- **Hugging Face**: https://huggingface.co/models (search for "stable-diffusion")
- **Tensor.Art**: https://tensor.art/models

**Manual Installation:**
1. Download a `.safetensors` or `.ckpt` file
2. Place it in `comfyui/models/checkpoints/`
3. Restart ComfyUI
4. The model will be automatically available

**Alternative: HybridSamplers Plugin**
For experimental samplers and schedulers:
```bash
cd comfyui/custom_nodes
git clone https://github.com/azazeal04/ComfyUI-HybridSamplers.git
cd ComfyUI-HybridSamplers
pip install -r requirements.txt
```

### Out of Memory

**ComfyUI Memory Optimization:**

ComfyUI supports several memory optimization modes. Test which works best for your system:

```bash
# Run the memory testing script
./scripts/test-comfyui-memory.sh
```

**Available Memory Modes:**

1. **`--normalvram`** - Normal VRAM usage (requires CUDA/GPU, not available on macOS)
2. **`--lowvram`** - Reduced VRAM usage (requires CUDA/GPU, not available on macOS)
3. **`--novram`** - Use CPU instead of GPU (requires CUDA initialization, not available on macOS)
4. **`--cpu`** - Force CPU mode (✅ **Required on macOS** - auto-enabled by default)

**Note for macOS users:** Since PyTorch is installed with CPU-only support, you must use `--cpu` mode. The startup scripts automatically detect macOS and use `--cpu` mode with `--use-split-cross-attention` for optimal memory usage.

**To use a specific mode:**

Set the `COMFYUI_MEMORY_MODE` environment variable:

```bash
# In your terminal
export COMFYUI_MEMORY_MODE=--lowvram
npm run dev:comfyui
```

Or add to `.env.local`:

```env
COMFYUI_MEMORY_MODE=--lowvram
```

**Other Memory Tips:**

- Use smaller models: `llava:7b` instead of `qwen3-vl:8b`
- Close other applications
- Reduce ComfyUI steps/resolution in workflow options
- Use `--lowvram` if you have 4-8GB VRAM
- Use `--novram` or `--cpu` if you have limited system RAM

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TypeScript |
| Styling | Tailwind CSS, ShadCN UI |
| AI Description | Ollama (qwen3-vl, llava) |
| Image Processing | ComfyUI (Stable Diffusion) |
| Streaming | Server-Sent Events |

---

## Privacy Guarantee

```
┌─────────────────────────────────────────────┐
│  Images stored locally (./uploads)          │
│  AI runs on localhost:11434 (Ollama)        │
│  Processing on localhost:8188 (ComfyUI)     │
│  Zero external API calls                    │
│  No API keys required                       │
│  Works offline after setup                  │
└─────────────────────────────────────────────┘
```

**Your images never leave your machine.**

---

## License

See [LICENSE](./LICENSE) file.
