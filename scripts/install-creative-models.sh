#!/bin/bash

# Install Creative/Artistic Diffusion Models for ComfyUI
# These models produce more creative, surreal, and artistic outputs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHECKPOINTS_DIR="$PROJECT_ROOT/comfyui/models/checkpoints"

# Create checkpoints directory if it doesn't exist
mkdir -p "$CHECKPOINTS_DIR"

cd "$CHECKPOINTS_DIR"

echo "🎨 Installing Creative Diffusion Models for ComfyUI"
echo "📁 Checkpoints directory: $CHECKPOINTS_DIR"
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
    curl -L -o "$filename" "$url" || {
        echo "❌ Failed to download $name"
        return 1
    }
    echo "✅ Installed: $filename"
    echo ""
}

# Creative/Artistic Models (weird, surreal, artistic)

echo "=== Creative & Artistic Models ==="
echo ""

# 1. DreamShaper 8 - Dreamy, painterly, hyper-realistic with artistic flair
download_model "DreamShaper 8" \
    "https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8.safetensors" \
    "DreamShaper_8.safetensors"

# 2. Deliberate v2 - Highly creative, good at following complex prompts
download_model "Deliberate v2" \
    "https://huggingface.co/XpucT/Deliberate/resolve/main/Deliberate_v2.safetensors" \
    "Deliberate_v2.safetensors"

# 3. AbyssOrangeMix3 - Anime/artistic style, very creative
download_model "AbyssOrangeMix3" \
    "https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AbyssOrangeMix3.safetensors" \
    "AbyssOrangeMix3.safetensors"

# 4. Anything V5 - Popular anime/artistic model, very creative
download_model "Anything V5" \
    "https://huggingface.co/andite/anything-v4.0/resolve/main/anything-v5.0-pruned.safetensors" \
    "anything-v5.0-pruned.safetensors"

# 5. ChilloutMix - Realistic but with artistic flair
download_model "ChilloutMix" \
    "https://huggingface.co/TASUKU2023/Chilloutmix/resolve/main/chilloutmix_NiPrunedFp32Fix.safetensors" \
    "chilloutmix_NiPrunedFp32Fix.safetensors"

# 6. Realistic Vision V5.1 - Photorealistic but can be pushed to creative
download_model "Realistic Vision V5.1" \
    "https://huggingface.co/SG161222/Realistic_Vision_V5.1_noVAE/resolve/main/Realistic_Vision_V5.1_fp16-no-ema.safetensors" \
    "Realistic_Vision_V5.1_fp16-no-ema.safetensors"

# 7. RevAnimated v122 - Highly creative, excellent for weird/artistic outputs
download_model "RevAnimated v122" \
    "https://huggingface.co/hanafuusen2001/ReVAnimated/resolve/main/revAnimated_v122.safetensors" \
    "revAnimated_v122.safetensors"

echo ""
echo "✅ Creative models installation complete!"
echo ""
echo "📋 Installed models:"
ls -lh *.safetensors 2>/dev/null | awk '{print "   - " $9 " (" $5 ")"}' || echo "   (none found)"
echo ""
echo "💡 To use a specific model, set COMFYUI_CHECKPOINT in your .env.local:"
echo "   COMFYUI_CHECKPOINT=DreamShaper_8.safetensors"
echo ""
echo "   Or specify it in the API call when processing images."
echo ""
echo "🔄 Restart ComfyUI to detect new models:"
echo "   npm run dev:comfyui"
echo ""
