# Local-Only Operation Guide

## 🏠 Complete Local Image Generation Application

Anthroposcenic is designed to run **100% locally** on your machine. All AI processing, image generation, and data storage happens on your computer with zero external API calls.

## What "Local-Only" Means

✅ **All processing on your machine:**
- Images uploaded and stored locally
- AI description generation via local Ollama
- Image processing via local ComfyUI
- All workflows built programmatically in code

✅ **No external services:**
- No cloud APIs
- No external AI services
- No data sent over the network
- No API keys required

✅ **Complete privacy:**
- Images never leave your computer
- Descriptions generated locally
- No tracking or logging by external services
- Full control over your data

## Architecture

```
┌─────────────────────────────────────────┐
│     Your Local Machine                  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │      Next.js Application          │  │
│  │      (Port 3000)                  │  │
│  │      - Image Upload               │  │
│  │      - UI Components              │  │
│  │      - API Routes                 │  │
│  └──────────────────────────────────┘  │
│           │           │                 │
│           │           │                 │
│           ▼           ▼                 │
│  ┌──────────────┐  ┌──────────────┐    │
│  │   Ollama     │  │   ComfyUI   │    │
│  │ (Port 11434) │  │ (Port 8188) │    │
│  │              │  │             │    │
│  │ Vision Model │  │ SD Models   │    │
│  │ (Local RAM)  │  │ (Local GPU) │    │
│  └──────────────┘  └──────────────┘    │
│                                         │
│  All services communicate via          │
│  localhost - no external network       │
└─────────────────────────────────────────┘
```

## Services

### 1. Ollama (Local AI)
- **Location**: `http://localhost:11434`
- **Purpose**: Image description generation
- **Models**: Stored locally on your machine
- **Processing**: CPU/GPU on your machine
- **Setup**: See [OLLAMA_SETUP.md](./OLLAMA_SETUP.md)

### 2. ComfyUI (Local Image Generation)
- **Location**: `http://localhost:8188`
- **Purpose**: Image processing and generation
- **Models**: Stored locally in `comfyui/models/`
- **Workflows**: Built programmatically in code
- **Processing**: CPU/GPU on your machine
- **Setup**: See [COMFYUI_SETUP.md](./COMFYUI_SETUP.md)

### 3. Next.js Application
- **Location**: `http://localhost:3000`
- **Purpose**: Web interface and API
- **Storage**: Local file system (`./uploads`)
- **Communication**: All via localhost

## Data Flow (All Local)

```
1. User uploads image
   ↓ (stored in ./uploads/)
   
2. Image sent to local Ollama
   ↓ (localhost:11434)
   
3. Description generated locally
   ↓ (streamed to browser)
   
4. Image + description sent to local ComfyUI
   ↓ (localhost:8188)
   
5. Image processed locally
   ↓ (workflow built in code)
   
6. Result streamed back
   ↓ (displayed in browser)
```

**No step involves external services or network calls beyond localhost.**

## Privacy Benefits

### Data Control
- **Images**: Stored only on your machine
- **Descriptions**: Generated locally, never sent anywhere
- **Processed Images**: Created and stored locally
- **Models**: Downloaded once, stored locally

### No External Dependencies
- **No API Keys**: No authentication with external services
- **No Rate Limits**: Process as many images as you want
- **No Costs**: No per-request charges
- **No Tracking**: No usage analytics sent to third parties

### Offline Capable
- Works without internet (after initial setup)
- Models downloaded once, used forever
- No connection required for processing

## Resource Requirements

### Minimum
- **RAM**: 8GB (16GB+ recommended)
- **Storage**: 20GB+ (for models and images)
- **CPU**: Modern multi-core processor

### Recommended
- **RAM**: 16GB+
- **Storage**: 50GB+ (for multiple models)
- **GPU**: NVIDIA GPU with CUDA or Apple Silicon
- **CPU**: 8+ cores

### Model Sizes
- **Ollama Vision Models**: 4-8GB each
- **ComfyUI Checkpoints**: 2-7GB each
- **Total**: Plan for 20-50GB for a complete setup

## Configuration

### Environment Variables

All services must be configured for localhost:

```env
# Ollama (Local)
OLLAMA_HOST=http://localhost:11434  # NEVER change to external URL

# ComfyUI (Local)
COMFYUI_HOST=http://localhost:8188  # NEVER change to external URL
COMFYUI_WS_URL=ws://localhost:8188/ws

# Storage (Local)
UPLOAD_DIR=./uploads
TEMP_DIR=./temp
```

**⚠️ Important:** Never configure external URLs. This breaks the local-only architecture.

## Verification

### Check All Services Are Local

1. **Ollama:**
   ```bash
   curl http://localhost:11434/api/tags
   # Should return JSON, not error
   ```

2. **ComfyUI:**
   ```bash
   curl http://localhost:8188/system_stats
   # Should return JSON, not error
   ```

3. **Next.js:**
   ```bash
   curl http://localhost:3000
   # Should return HTML
   ```

### Network Monitoring

You can verify no external calls are made:
- Use network monitoring tools
- Check that all requests go to `localhost` or `127.0.0.1`
- No requests to external domains

## Troubleshooting

### "Connection Refused" Errors

**Ollama:**
```bash
ollama serve
```

**ComfyUI:**
```bash
cd comfyui
source venv/bin/activate
python main.py
```

### Services Not Starting

1. Check ports aren't in use:
   ```bash
   lsof -i :11434  # Ollama
   lsof -i :8188   # ComfyUI
   lsof -i :3000   # Next.js
   ```

2. Kill existing processes if needed:
   ```bash
   pkill ollama
   pkill -f "python.*main.py"
   ```

### Performance Issues

1. **Use GPU acceleration** (if available)
2. **Close other applications** to free RAM
3. **Use smaller models** if RAM is limited
4. **Process images sequentially** rather than in parallel

## Security Considerations

### Local Network

Even though everything is local, consider:
- Firewall rules (optional, for extra security)
- File permissions on upload directories
- Clean up temporary files regularly

### File Storage

- Uploaded images stored in `./uploads/`
- Processed images in `comfyui/output/`
- Consider cleanup scripts for old files

## Benefits of Local-Only

✅ **Privacy**: Complete data control
✅ **Cost**: No API charges
✅ **Speed**: No network latency
✅ **Reliability**: No external service dependencies
✅ **Customization**: Full control over models and workflows
✅ **Offline**: Works without internet
✅ **Security**: No data transmission risks

## Migration from Cloud Services

If you're used to cloud-based AI services, this local approach offers:

- **Better Privacy**: No data leaves your machine
- **No Costs**: One-time model download, unlimited use
- **Faster**: No network round-trips
- **Customizable**: Use any model, modify workflows
- **Reliable**: No API rate limits or downtime

## Next Steps

1. ✅ Install Ollama locally ([OLLAMA_SETUP.md](./OLLAMA_SETUP.md))
2. ✅ Install ComfyUI locally ([COMFYUI_SETUP.md](./COMFYUI_SETUP.md))
3. ✅ Configure all services for localhost
4. ✅ Verify no external connections
5. ✅ Start processing images locally!

**Welcome to completely local, privacy-first AI image processing!** 🎉
