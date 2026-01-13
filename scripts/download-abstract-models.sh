#!/bin/bash

# Script to download abstract art models for ComfyUI

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKPOINTS_DIR="$PROJECT_ROOT/comfyui/models/checkpoints"

# Create checkpoints directory if it doesn't exist
mkdir -p "$CHECKPOINTS_DIR"

cd "$CHECKPOINTS_DIR"

echo "Downloading Abstract Art Models for ComfyUI..."
echo ""

# Function to download a model
download_model() {
    local name=$1
    local url=$2
    local filename=$3
    
    if [ -f "$filename" ]; then
        echo "✅ $name already installed: $filename"
        return 0
    fi
    
    echo "⬇️  Downloading $name..."
    echo "   URL: $url"
    echo "   This may take several minutes..."
    
    if curl -L --progress-bar -o "$filename" "$url"; then
        if [ -f "$filename" ]; then
            filesize=$(ls -lh "$filename" | awk '{print $5}')
            echo "✅ Successfully downloaded: $filename ($filesize)"
        else
            echo "❌ Download failed: File not found after download"
            return 1
        fi
    else
        echo "❌ Failed to download $name"
        rm -f "$filename"  # Clean up partial download
        return 1
    fi
    echo ""
}

# Abstract/Artistic Models
echo "=== Abstract Art Models ==="
echo ""

download_model "Openjourney v4" \
    "https://huggingface.co/prompthero/openjourney/resolve/main/mdjrny-v4.safetensors" \
    "openjourney-v4.safetensors"

download_model "Protogen v2.2" \
    "https://huggingface.co/darkstorm2150/Protogen_v2.2_Official_Release/resolve/main/Protogen_V2.2.safetensors" \
    "protogen-v2.2.safetensors"

download_model "Analog Diffusion" \
    "https://huggingface.co/wavymulder/Analog-Diffusion/resolve/main/analog-diffusion-1.0.safetensors" \
    "analog-diffusion.safetensors"

download_model "Inkpunk Diffusion" \
    "https://huggingface.co/Envvi/Inkpunk-Diffusion/resolve/main/inkpunk-diffusion.safetensors" \
    "inkpunk-diffusion.safetensors"

download_model "Pastel Mix" \
    "https://huggingface.co/andite/pastel-mix/resolve/main/pastelMix.safetensors" \
    "pastel-mix.safetensors"

download_model "Waifu Diffusion" \
    "https://huggingface.co/hakurei/waifu-diffusion/resolve/main/wd-1-4-anime_e2.safetensors" \
    "waifu-diffusion.safetensors"

download_model "Epic Diffusion" \
    "https://huggingface.co/xyn-ai/epic-diffusion/resolve/main/epicDiffusion.safetensors" \
    "epic-diffusion.safetensors"

echo ""
echo "=== Download Summary ==="
ls -lh *.safetensors 2>/dev/null | grep -E "(openjourney|protogen|analog|inkpunk|pastel|waifu|epic)" | awk '{print "   - " $9 " (" $5 ")"}' || echo "   (none downloaded)"

echo ""
echo "✅ Abstract art models download complete!"
echo ""
echo "These models are now available in the ComfyUI configuration dropdown."
