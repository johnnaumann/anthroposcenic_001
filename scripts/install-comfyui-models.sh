#!/bin/bash

# ComfyUI Models Installation Script
# This script helps install common ComfyUI models

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"
MODELS_DIR="$COMFYUI_DIR/models"

# Check if ComfyUI is installed
if [ ! -d "$COMFYUI_DIR" ]; then
    echo "❌ ComfyUI is not installed!"
    echo "Run ./scripts/setup-comfyui.sh first"
    exit 1
fi

echo "📦 ComfyUI Models Installation"
echo ""
echo "This script will help you download common models for ComfyUI."
echo "Models will be downloaded to: $MODELS_DIR"
echo ""

# Create models directory structure
mkdir -p "$MODELS_DIR/checkpoints"
mkdir -p "$MODELS_DIR/vae"
mkdir -p "$MODELS_DIR/loras"
mkdir -p "$MODELS_DIR/upscale_models"
mkdir -p "$MODELS_DIR/controlnet"

echo "📁 Model directories created"
echo ""
echo "To download models, you can:"
echo ""
echo "1. Download manually from:"
echo "   - Hugging Face: https://huggingface.co/models"
echo "   - Civitai: https://civitai.com"
echo ""
echo "2. Use the ComfyUI Manager (recommended):"
echo "   - Install ComfyUI Manager custom node"
echo "   - Use it to download models directly from the UI"
echo ""
echo "3. Download via command line (example for Stable Diffusion):"
echo "   cd $MODELS_DIR/checkpoints"
echo "   wget <model-url>"
echo ""
echo "Common model locations:"
echo "  - Checkpoints: $MODELS_DIR/checkpoints"
echo "  - VAE: $MODELS_DIR/vae"
echo "  - LoRAs: $MODELS_DIR/loras"
echo "  - Upscale: $MODELS_DIR/upscale_models"
echo "  - ControlNet: $MODELS_DIR/controlnet"
