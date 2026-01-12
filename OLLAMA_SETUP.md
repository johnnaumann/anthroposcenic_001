# Ollama Setup Guide - Local Installation

This guide will help you install and run Ollama locally for the Anthroposcenic application. **This is a completely local setup** - all AI processing happens on your machine with no data sent to external services.

## What is Ollama?

Ollama is a tool for running large language models locally on your machine. For this application, we use vision models (like Qwen2.5-VL) that can analyze images and generate detailed descriptions - all running entirely on your local computer.

## Prerequisites

- macOS, Linux, or Windows
- At least 8GB RAM (16GB+ recommended for vision models)
- Sufficient disk space for models (vision models can be 4-8GB+)

## Installation

### macOS

**Option 1: Using Homebrew (Recommended)**
```bash
brew install ollama
```

**Option 2: Direct Download**
1. Visit https://ollama.com/download
2. Download the macOS installer
3. Run the installer
4. Ollama will be available in your Applications folder

### Linux

**Option 1: Using the install script**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Option 2: Manual installation**
1. Visit https://ollama.com/download
2. Download the Linux binary
3. Make it executable: `chmod +x ollama`
4. Move to PATH: `sudo mv ollama /usr/local/bin/`

### Windows

1. Visit https://ollama.com/download
2. Download the Windows installer
3. Run the installer
4. Ollama will be available in your Start menu

## Starting Ollama

After installation, Ollama runs as a local service:

```bash
ollama serve
```

**Note:** On macOS and Linux, Ollama may start automatically as a background service. You can verify it's running by checking:

```bash
curl http://localhost:11434/api/tags
```

If you get a JSON response, Ollama is running!

## Installing Vision Models

For image description, you need a vision-capable model. Recommended models:

### Qwen2.5-VL (Recommended)
```bash
ollama pull qwen2.5-vl:latest
```

**Why Qwen2.5-VL?**
- Excellent vision understanding
- Supports "thinking" process (shows reasoning)
- Good balance of quality and speed
- ~7GB download

### Alternative Vision Models

**LLaVA (Smaller, Faster)**
```bash
ollama pull llava:latest
```
- Faster inference
- Smaller model (~4GB)
- Good for quick descriptions

**LLaVA 1.6 (Better Quality)**
```bash
ollama pull llava:13b
```
- Higher quality descriptions
- Larger model (~7GB)
- Slower but more detailed

**BakLLaVA (Alternative)**
```bash
ollama pull bakllava:latest
```
- Good alternative vision model
- ~4GB

## Verifying Installation

1. **Check Ollama is running:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. **List installed models:**
   ```bash
   ollama list
   ```

3. **Test a model:**
   ```bash
   ollama run qwen2.5-vl "Describe what you see in this image" --image path/to/image.jpg
   ```

## Configuration

### Default Settings

Ollama runs on `http://localhost:11434` by default. The application is configured to use this local endpoint.

### Environment Variables

In your `.env.local` file:
```env
# Ollama Configuration (Local)
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5-vl:latest
```

**Important:** Keep `OLLAMA_HOST` as `http://localhost:11434` to ensure all processing stays local.

## Local-Only Operation

### What Runs Locally

✅ **All AI processing happens on your machine:**
- Image analysis
- Description generation
- Model inference
- No data sent to external servers
- No internet required after model download

### Privacy & Security

- **100% Private**: Images never leave your computer
- **No API Keys**: No external services or authentication needed
- **Offline Capable**: Works without internet (after initial model download)
- **Data Control**: All processing happens in your local environment

### Resource Usage

Vision models require:
- **RAM**: 8-16GB recommended
- **CPU**: Modern multi-core processor
- **GPU** (Optional): NVIDIA GPU with CUDA support for faster inference
  - Install CUDA-enabled Ollama for GPU acceleration
  - Significantly faster processing

## GPU Acceleration (Optional)

### NVIDIA GPU (CUDA)

1. **Install CUDA Toolkit** from NVIDIA
2. **Install CUDA-enabled Ollama:**
   ```bash
   # Linux
   curl -fsSL https://ollama.com/install.sh | OLLAMA_USE_CUDA=1 sh
   ```

3. **Verify GPU usage:**
   ```bash
   ollama run qwen2.5-vl "test" --verbose
   # Look for CUDA/GPU mentions in output
   ```

### Apple Silicon (M1/M2/M3)

Ollama automatically uses Apple's Neural Engine and Metal acceleration on Apple Silicon Macs. No additional setup needed!

## Troubleshooting

### Ollama Not Starting

**Check if port 11434 is in use:**
```bash
lsof -i :11434
```

**Kill existing Ollama processes:**
```bash
pkill ollama
ollama serve
```

### Model Not Found

**Verify model is installed:**
```bash
ollama list
```

**Re-pull the model:**
```bash
ollama pull qwen2.5-vl:latest
```

### Out of Memory

**Use a smaller model:**
```bash
ollama pull llava:latest  # Smaller than Qwen2.5-VL
```

**Or reduce context window** (modify in application code if needed)

### Slow Performance

1. **Use GPU acceleration** (see above)
2. **Use a smaller model** (llava instead of qwen2.5-vl)
3. **Close other applications** to free up RAM
4. **Check system resources:**
   ```bash
   # macOS/Linux
   top
   # or
   htop
   ```

### Connection Refused

**Ensure Ollama is running:**
```bash
ollama serve
```

**Check firewall settings** (should allow localhost connections)

## Integration with Anthroposcenic

The application connects to your local Ollama instance:

1. **Image Upload** → Stored locally
2. **Ollama Processing** → Runs on `localhost:11434`
3. **Description Generation** → Happens entirely on your machine
4. **Streaming Response** → Sent directly to browser

All communication stays on `localhost` - nothing goes over the network.

## Model Management

### Update a Model
```bash
ollama pull qwen2.5-vl:latest
```

### Remove a Model
```bash
ollama rm qwen2.5-vl:latest
```

### Show Model Info
```bash
ollama show qwen2.5-vl:latest
```

### List All Models
```bash
ollama list
```

## Performance Tips

1. **First Run**: Models load into memory on first use (may take 30-60 seconds)
2. **Subsequent Runs**: Much faster as model stays in memory
3. **GPU**: Dramatically faster if available
4. **Model Size**: Larger models = better quality but slower
5. **Batch Processing**: Process multiple images sequentially for better memory usage

## Next Steps

1. ✅ Install Ollama
2. ✅ Pull a vision model (`qwen2.5-vl:latest` recommended)
3. ✅ Verify Ollama is running (`ollama serve`)
4. ✅ Start the Anthroposcenic application
5. ✅ Upload an image and watch it process locally!

## Resources

- [Ollama Official Site](https://ollama.com)
- [Ollama GitHub](https://github.com/ollama/ollama)
- [Available Models](https://ollama.com/library)
- [Qwen2.5-VL Model](https://ollama.com/library/qwen2.5-vl)

## Local-Only Architecture

```
┌─────────────────────────────────────────┐
│     Your Local Machine                  │
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │  Next.js App │───▶│   Ollama     │  │
│  │  (Port 3000) │    │ (Port 11434) │  │
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
│  └──────────────┘                      │
│                                         │
│  All processing stays local!           │
│  No external API calls.                │
└─────────────────────────────────────────┘
```

**Everything runs on your machine. No cloud. No external services. Complete privacy.**
