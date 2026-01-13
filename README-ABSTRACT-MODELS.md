# Abstract Art Models for ComfyUI

This document lists the abstract and artistic models available for use with ComfyUI in this project.

## Available Abstract Art Models

### 1. **Openjourney v4** (`openjourney-v4.safetensors`)
- **Style**: Midjourney-style abstract art
- **Size**: ~2.1 GB
- **Usage**: Include "mdjrny-v4 style" in your prompts for best results
- **Best for**: Surreal, dreamy, artistic compositions
- **Download**: Automatically available via model registry

### 2. **Protogen v2.2** (`protogen-v2.2.safetensors`)
- **Style**: High-quality, creative, versatile
- **Size**: ~4-7 GB (varies)
- **Best for**: Abstract compositions, creative interpretations
- **Download**: Automatically available via model registry

### 3. **Analog Diffusion** (`analog-diffusion.safetensors`)
- **Style**: Analog film photography aesthetic
- **Size**: ~2-4 GB
- **Usage**: Include "analog style" in prompts. Add "blur" and "haze" to negative prompts for sharper images
- **Best for**: Abstract art with vintage/analog film look
- **Download**: Automatically available via model registry

### 4. **Inkpunk Diffusion** (`inkpunk-diffusion.safetensors`)
- **Style**: Cyberpunk, inkpunk aesthetic
- **Size**: ~2-4 GB
- **Best for**: Abstract art with cyberpunk/urban aesthetic
- **Download**: Automatically available via model registry

### 5. **Pastel Mix** (`pastel-mix.safetensors`)
- **Style**: Soft, pastel, artistic
- **Size**: ~2-4 GB
- **Best for**: Abstract art with soft, pastel color palettes
- **Download**: Automatically available via model registry

### 6. **Waifu Diffusion** (`waifu-diffusion.safetensors`)
- **Style**: Anime/artistic, creative
- **Size**: ~2-4 GB
- **Best for**: Abstract art with anime-inspired aesthetics
- **Download**: Automatically available via model registry

### 7. **Epic Diffusion** (`epic-diffusion.safetensors`)
- **Style**: General-purpose, heavily calibrated merge
- **Size**: ~2-4 GB
- **Best for**: High-quality abstract art, versatile styles
- **Download**: Automatically available via model registry

## How to Use

1. **Select in UI**: These models will appear in the checkpoint dropdown in the configuration step
2. **Auto-download**: If a model isn't installed, it will be automatically downloaded when selected
3. **Manual download**: Use the validation script to download all models:
   ```bash
   ./scripts/validate-and-redownload-models.sh
   ```

## Tips for Abstract Art Generation

- **Lower CFG Scale** (5-7): More creative, less prompt adherence
- **Higher Denoise Strength** (0.6-0.8): More variation from input image
- **Creative Samplers**: Try `dpmpp_2m_karras` or `euler_a` for more artistic results
- **Negative Prompts**: Add "realistic, photorealistic" to push toward abstract
- **Style Keywords**: Include style keywords like "abstract", "surreal", "artistic", "painterly"

## Model Registry

All models are registered in `lib/model-downloader.ts` and can be automatically downloaded when needed.
