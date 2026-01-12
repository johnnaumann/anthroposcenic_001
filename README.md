# Anthroposcenic - Local AI Image Processing Pipeline

**A completely local, privacy-first image processing application** that runs entirely on your machine with no external API calls or cloud services.

## 🏠 100% Local Operation

This application processes images **completely locally**:
- ✅ All AI models run on your machine
- ✅ No data sent to external servers
- ✅ No API keys required
- ✅ Works offline (after initial setup)
- ✅ Complete privacy and data control

**See [LOCAL_ONLY.md](./LOCAL_ONLY.md) for complete details on local-only operation.**

## How It Works

1. Upload an image
2. Generate a text description using **local Ollama** (thinking model like Qwen)
3. Stream the description to the browser
4. Send image + description to **local ComfyUI**
5. Stream ComfyUI output back to the application

**Everything runs on `localhost` - no cloud, no external services.**

## Technology Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: ShadCN UI
- **AI Model**: Ollama (Qwen2.5-VL or similar)
- **Image Processing**: ComfyUI

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Python 3.8+ (for ComfyUI)
- Git
- **Ollama** installed locally (see [OLLAMA_SETUP.md](./OLLAMA_SETUP.md))
- **ComfyUI** installed locally (see [COMFYUI_SETUP.md](./COMFYUI_SETUP.md))
- Qwen2.5-VL or similar vision model (installed locally via Ollama)

**All services run on your local machine - no cloud required!**

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

2. **Set up Ollama (Local AI):**
   ```bash
   # Automated setup (recommended)
   npm run ollama:setup
   # or manually: ./scripts/setup-ollama.sh
   ```
   
   See [OLLAMA_SETUP.md](./OLLAMA_SETUP.md) for detailed instructions.
   
   **Important:** This installs and runs Ollama locally on your machine. All AI processing happens on `localhost:11434`.

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   # Ollama Configuration (Local - runs on your machine)
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_MODEL=qwen3-vl:8b

   # ComfyUI Configuration (Local - runs on your machine)
   COMFYUI_HOST=http://localhost:8188
   COMFYUI_WS_URL=ws://localhost:8188/ws

   # File Upload (Local storage)
   MAX_FILE_SIZE=10485760
   UPLOAD_DIR=./uploads
   TEMP_DIR=./temp

   # Next.js
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

4. **Set up ComfyUI:**
   ```bash
   # Automated setup (recommended)
   npm run comfyui:setup
   # or manually: ./scripts/setup-comfyui.sh
   ```
   
   See [COMFYUI_SETUP.md](./COMFYUI_SETUP.md) for detailed instructions.

5. **Start ComfyUI:**
   ```bash
   npm run comfyui:run
   # or manually: ./scripts/run-comfyui.sh
   ```
   
   ComfyUI will be available at http://localhost:8188 (local only)

6. **Install Ollama models:**
   ```bash
   npm run ollama:models
   # or manually: ./scripts/install-ollama-models.sh
   ```
   
   This will install the recommended vision model (qwen2.5-vl:latest) from `config/models.json`.

7. **Verify Ollama is running:**
   ```bash
   npm run ollama:check
   # or manually: ./scripts/check-ollama.sh
   ```

8. **Start the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

9. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Local-Only Architecture

```
┌─────────────────────────────────────────┐
│     Your Local Machine                  │
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │  Next.js App │───▶│   Ollama     │  │
│  │  (Port 3000) │    │ (Port 11434) │  │
│  │              │    │   LOCAL      │  │
│  └──────────────┘    └──────────────┘  │
│         │                  │            │
│         │                  ▼            │
│         │          ┌──────────────┐    │
│         │          │ Vision Model │    │
│         │          │  (Local RAM)  │    │
│         │          └──────────────┘    │
│         │                              │
│         ▼                              │
│  ┌──────────────┐                      │
│  │   ComfyUI    │                      │
│  │ (Port 8188)  │                      │
│  │    LOCAL     │                      │
│  └──────────────┘                      │
│                                         │
│  ✅ All processing stays local!        │
│  ✅ No external API calls               │
│  ✅ Complete privacy                    │
└─────────────────────────────────────────┘
```

## Ollama Setup (Local AI)

Ollama runs completely locally on your machine. See [OLLAMA_SETUP.md](./OLLAMA_SETUP.md) for detailed setup instructions.

**Quick start:**
```bash
# Install and verify Ollama
npm run ollama:setup

# Check status
npm run ollama:check
```

**Key points:**
- All AI processing happens on `localhost:11434`
- Models are downloaded once and stored locally
- No internet required after setup (except for initial model download)
- Complete privacy - images never leave your machine

## ComfyUI Setup

ComfyUI setup is automated via scripts. For detailed instructions, see [COMFYUI_SETUP.md](./COMFYUI_SETUP.md).

**Quick start:**
```bash
# Install ComfyUI
npm run comfyui:setup

# Run ComfyUI
npm run comfyui:run
```

**Note:** You'll need to install at least one model checkpoint for ComfyUI to work. See the setup guide for details.

## Project Structure

```
app/
├── api/
│   ├── upload/route.ts          # Image upload endpoint
│   ├── describe/route.ts         # Ollama description streaming
│   ├── comfyui/process/route.ts  # ComfyUI processing
│   └── images/[imageId]/route.ts # Image retrieval
├── components/
│   ├── ui/                       # ShadCN UI components
│   ├── ImageUploadZone.tsx
│   ├── DescriptionStream.tsx
│   ├── ComfyUIProgress.tsx
│   └── PipelineStatus.tsx
├── lib/
│   ├── ollama.ts                 # Ollama client utilities
│   ├── comfyui.ts                # ComfyUI client utilities
│   ├── streaming.ts              # Streaming utilities
│   └── utils.ts                  # General utilities
├── types/
│   └── index.ts                  # TypeScript types
└── page.tsx                      # Main application page
```

## API Routes

### POST `/api/upload`
Upload an image file. Returns image metadata including `imageId`.

### POST `/api/describe`
Stream image description from Ollama. Takes `imageId` and optional `model` parameter.

### POST `/api/comfyui/process`
Process image with ComfyUI. Takes `imageId` and `description`.

### GET `/api/images/[imageId]`
Retrieve uploaded image by ID.

### GET `/api/models`
Get available Ollama models from configuration.

## Usage

1. **Upload an image** using the drag-and-drop zone or file picker
2. **Wait for description** - The app automatically sends the image to Ollama and streams the description
3. **Review the description** - You can copy it if needed
4. **ComfyUI processing** - The app automatically sends the image and description to ComfyUI
5. **View results** - The processed image will appear when ComfyUI completes

## Configuration

### Local Services

All services run locally on your machine:

- **Ollama**: `http://localhost:11434` (local AI processing)
- **ComfyUI**: `http://localhost:8188` (local image generation)
- **Next.js**: `http://localhost:3000` (application)

**Never change these to external URLs** - this application is designed for local-only operation.

### Ollama Models (Local)
Models are configured in `config/models.json`. The default model is `qwen2.5-vl:latest`.

**Available models:**
- `qwen3-vl:8b` - Recommended (thinking process, ~6GB) ✅ You have this installed
- `llava:7b` - Faster alternative (~4GB) ✅ You have this installed
- `qwen2.5-vl:latest` - Alternative (if available, ~7GB)
- `llava:13b` - Higher quality (~7GB)
- `bakllava:latest` - Alternative option (~4GB)

**Install models:**
```bash
npm run ollama:models
```

**Change model:**
- Set `OLLAMA_MODEL` in `.env.local`
- Or modify `config/models.json` to change the default

All models run locally on your machine - no cloud API calls.

### ComfyUI Workflow (Local)
The ComfyUI workflow is created programmatically in `lib/comfyui.ts`. All workflows run locally on your machine. See [COMFYUI_WORKFLOW.md](./COMFYUI_WORKFLOW.md) for details on how workflows are built in code.

### File Upload
- Maximum file size: 10MB (configurable via `MAX_FILE_SIZE`)
- Allowed formats: JPEG, PNG, GIF, WEBP
- Upload directory: `./uploads` (configurable via `UPLOAD_DIR`)

## Development

### Build for production:
```bash
npm run build
npm start
```

### Lint:
```bash
npm run lint
```

## Privacy & Local-Only Operation

This application is designed for **complete local operation**:

✅ **All processing happens on your machine:**
- Image uploads stored locally
- AI description generation via local Ollama
- Image processing via local ComfyUI
- No external API calls
- No data leaves your computer

✅ **Privacy benefits:**
- Images never sent to external services
- No API keys or authentication required
- Works offline (after initial setup)
- Complete control over your data

⚠️ **Important:** Keep all services on `localhost`. Do not configure external URLs.

## Troubleshooting

### Ollama Connection Issues (Local)
- Ensure Ollama is running locally: `ollama serve`
- Check `OLLAMA_HOST` is `http://localhost:11434` (not external URL)
- Verify model is installed locally: `ollama list`
- Run health check: `npm run ollama:check`

### ComfyUI Connection Issues (Local)
- Ensure ComfyUI is running locally
- Check `COMFYUI_HOST` is `http://localhost:8188` (not external URL)
- Verify ComfyUI API is accessible: `curl http://localhost:8188/system_stats`
- Check that models are installed in `comfyui/models/`

### Image Upload Issues
- Check file size (max 10MB by default)
- Verify upload directory permissions
- Check file format (images only)

## License

See LICENSE file for details.
