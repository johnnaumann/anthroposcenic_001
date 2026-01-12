# Creative & Artistic Diffusion Models

This guide lists diffusion models that produce more creative, surreal, and "weird" outputs compared to standard Stable Diffusion models.

## Quick Install

```bash
npm run comfyui:install-creative-models
```

## Models Included in Install Script

### 1. DreamShaper 8
- **Style**: Dreamy, painterly, hyper-realistic with artistic flair
- **Best For**: Ethereal, moody concept art, slightly surreal visualizations
- **Size**: ~4GB
- **Download**: Automatically via install script

### 2. Deliberate v2
- **Style**: Highly creative, excellent prompt following
- **Best For**: Complex prompts, creative interpretations, artistic variations
- **Size**: ~4GB
- **Download**: Automatically via install script

### 3. AbyssOrangeMix3
- **Style**: Anime/artistic, very creative
- **Best For**: Anime-style art, creative illustrations
- **Size**: ~4GB
- **Download**: Automatically via install script

### 4. Anything V5
- **Style**: Popular anime/artistic model
- **Best For**: Anime-style images, creative illustrations
- **Size**: ~4GB
- **Download**: Automatically via install script

### 5. ChilloutMix
- **Style**: Realistic but with artistic flair
- **Best For**: Realistic images with creative touches
- **Size**: ~4GB
- **Download**: Automatically via install script

### 6. Realistic Vision V5.1
- **Style**: Photorealistic (can be pushed to creative)
- **Best For**: Realistic images, can be used creatively with high denoise
- **Size**: ~4GB
- **Download**: Automatically via install script

## Other Popular Creative Models (Manual Install)

### FineArt_OilPainting
- **Style**: Abstract surrealist, oil painting aesthetics
- **Best For**: Completely abstract images, surreal artworks
- **Where**: [Tensor.Art](https://tensor.art/models/771859520906449512)
- **Note**: Often produces abstract images; adjust prompts for more representational art

### Counterfeit V3
- **Style**: Artistic, creative, good at following prompts
- **Best For**: Artistic interpretations, creative variations
- **Where**: [Civitai](https://civitai.com/models/4468/counterfeit-v30)

### MeinaMix
- **Style**: Anime/artistic, very creative
- **Best For**: Anime-style art, creative illustrations
- **Where**: [Civitai](https://civitai.com/models/7240/meinamix)

### PastelMix
- **Style**: Soft, pastel, artistic
- **Best For**: Soft artistic images, pastel aesthetics
- **Where**: [Civitai](https://civitai.com/models/5414/pastelmix)

### RevAnimated
- **Style**: Highly creative, good at complex prompts
- **Best For**: Creative interpretations, artistic variations
- **Where**: [Civitai](https://civitai.com/models/7371/revanimated)

## Using Models

### Method 1: Environment Variable

Add to `.env.local`:
```env
COMFYUI_CHECKPOINT=DreamShaper_8.safetensors
```

### Method 2: Auto-Detection

If no checkpoint is specified, the app will use the first available model in `comfyui/models/checkpoints/`.

### Method 3: API Override

You can specify a checkpoint in the API call (if you modify the code to accept it).

## Installation Locations

Models should be placed in:
```
comfyui/models/checkpoints/
```

Supported formats:
- `.safetensors` (recommended, safer)
- `.ckpt` (legacy format)

## Tips for Weird/Creative Outputs

1. **Use High Denoise**: Set `COMFYUI_DENOISE=0.85` or higher for more variation
2. **Lower CFG Scale**: Set `COMFYUI_CFG_SCALE=5.0-6.0` for more creative freedom
3. **Use Creative Presets**: Set `COMFYUI_CREATIVITY=high` or `extreme`
4. **Experiment with Samplers**: Try `dpmpp_2m_karras`, `euler_ancestral`, or `dpm_2_ancestral`
5. **Combine Models**: Some models work well together when merged (advanced)

## Where to Find More Models

- **Civitai**: https://civitai.com/models (huge collection, filter by "Checkpoint")
- **Hugging Face**: https://huggingface.co/models (search "stable-diffusion")
- **Tensor.Art**: https://tensor.art/models
- **Stable Diffusion Models**: https://stable-diffusion-art.com/models/

## Model Recommendations by Use Case

**For Maximum Creativity/Weirdness:**
- Deliberate v2
- DreamShaper 8 (with high denoise)
- FineArt_OilPainting

**For Anime/Artistic Style:**
- AbyssOrangeMix3
- Anything V5
- MeinaMix

**For Realistic but Creative:**
- ChilloutMix
- Realistic Vision V5.1 (with high denoise)
- DreamShaper 8

**For Abstract/Surreal:**
- FineArt_OilPainting
- Deliberate v2 (with creative prompts)

## Troubleshooting

**Model not appearing:**
1. Check file is in `comfyui/models/checkpoints/`
2. File must be `.safetensors` or `.ckpt`
3. Restart ComfyUI: `npm run dev:comfyui`
4. Check ComfyUI logs for errors

**Model too large:**
- Use `--cpu` mode: `COMFYUI_MEMORY_MODE=--cpu`
- Reduce image size: Lower `MAX_IMAGE_WIDTH` and `MAX_IMAGE_HEIGHT`
- Use fewer steps: Lower `COMFYUI_STEPS`

**Model produces errors:**
- Ensure model is compatible with SD 1.5 or SDXL (check model requirements)
- Some models require specific VAE files (check model documentation)
- Try a different model if one consistently fails
