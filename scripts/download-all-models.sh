#!/bin/bash

# Download All ComfyUI Models Script
# Downloads all models from the MODEL_REGISTRY to avoid runtime downloads

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHECKPOINTS_DIR="$PROJECT_ROOT/comfyui/models/checkpoints"

# Create checkpoints directory if it doesn't exist
mkdir -p "$CHECKPOINTS_DIR"

cd "$CHECKPOINTS_DIR"

echo "📦 Downloading All ComfyUI Models"
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
    echo "   File: $filename"
    
    # Use curl with progress bar
    curl -L --progress-bar -o "$filename" "$url" || {
        echo "❌ Failed to download $name"
        return 1
    }
    
    # Check if file was downloaded successfully
    if [ -f "$filename" ] && [ -s "$filename" ]; then
        local size=$(du -h "$filename" | cut -f1)
        echo "✅ Installed: $filename ($size)"
    else
        echo "❌ Download failed or file is empty: $filename"
        return 1
    fi
    echo ""
}

# Models from MODEL_REGISTRY
echo "=== Downloading Models from Registry ==="
echo ""

# 1. Deliberate v2
download_model "Deliberate v2" \
    "https://huggingface.co/XpucT/Deliberate/resolve/main/Deliberate_v2.safetensors" \
    "Deliberate_v2.safetensors"

# 2. DreamShaper 8
download_model "DreamShaper 8" \
    "https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8.safetensors" \
    "DreamShaper_8.safetensors"

# 3. AbyssOrangeMix3
download_model "AbyssOrangeMix3" \
    "https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AbyssOrangeMix3.safetensors" \
    "AbyssOrangeMix3.safetensors"

# 4. Anything V5
download_model "Anything V5" \
    "https://huggingface.co/andite/anything-v4.0/resolve/main/anything-v5.0-pruned.safetensors" \
    "anything-v5.0-pruned.safetensors"

# 5. ChilloutMix
download_model "ChilloutMix" \
    "https://huggingface.co/TASUKU2023/Chilloutmix/resolve/main/chilloutmix_NiPrunedFp32Fix.safetensors" \
    "chilloutmix_NiPrunedFp32Fix.safetensors"

# 6. Realistic Vision V5.1
download_model "Realistic Vision V5.1" \
    "https://huggingface.co/SG161222/Realistic_Vision_V5.1_noVAE/resolve/main/Realistic_Vision_V5.1_fp16-no-ema.safetensors" \
    "Realistic_Vision_V5.1_fp16-no-ema.safetensors"

# 7. RevAnimated v122
download_model "RevAnimated v122" \
    "https://huggingface.co/hanafuusen2001/ReVAnimated/resolve/main/revAnimated_v122.safetensors" \
    "revAnimated_v122.safetensors"

# 8. Stable Diffusion v1.5
download_model "Stable Diffusion v1.5" \
    "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors" \
    "v1-5-pruned.safetensors"

# 9. SDArt Complete Edition (Abstract Art Model)
download_model "SDArt Complete Edition" \
    "https://huggingface.co/Guizmus/SDArt_Complete_Edition/resolve/main/SDArt_Complete_Edition.safetensors" \
    "SDArt_Complete_Edition.safetensors"

# Also create symlink for sd-v1-5.safetensors if it doesn't exist
if [ -f "v1-5-pruned.safetensors" ] && [ ! -f "sd-v1-5.safetensors" ]; then
    echo "🔗 Creating symlink: sd-v1-5.safetensors -> v1-5-pruned.safetensors"
    ln -s "v1-5-pruned.safetensors" "sd-v1-5.safetensors"
    echo ""
fi

# Note: If you find AbstractArt_v2.safetensors, you can add it manually:
# download_model "AbstractArt v2" \
#     "YOUR_URL_HERE" \
#     "AbstractArt_v2.safetensors"

echo ""
echo "✅ Model download complete!"
echo ""
echo "📋 Installed models:"
ls -lh *.safetensors 2>/dev/null | awk '{print "   - " $9 " (" $5 ")"}' || echo "   (none found)"
echo ""
echo "💡 Total disk space used:"
du -sh "$CHECKPOINTS_DIR" 2>/dev/null || echo "   (unable to calculate)"
echo ""
echo "🔄 Models are now available for ComfyUI processing"
echo ""
