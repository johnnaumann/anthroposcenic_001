#!/bin/bash

# Script to validate and re-download corrupted ComfyUI models

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKPOINTS_DIR="$PROJECT_ROOT/comfyui/models/checkpoints"

# Minimum size for a valid model file (1GB = 1073741824 bytes)
MIN_SIZE=1073741824

echo "Checking all checkpoint models for corruption..."
echo ""

cd "$CHECKPOINTS_DIR"

# Function to get download URL for a model
get_download_url() {
  local model="$1"
  case "$model" in
    "Deliberate_v2.safetensors")
      echo "https://huggingface.co/XpucT/Deliberate/resolve/main/Deliberate_v2.safetensors"
      ;;
    "DreamShaper_8_pruned.safetensors")
      echo "https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8_pruned.safetensors"
      ;;
    "AbyssOrangeMix3.safetensors")
      echo "https://huggingface.co/WarriorMama777/OrangeMixs/resolve/main/Models/AbyssOrangeMix3/AOM3.safetensors"
      ;;
    # anything-v5.0-pruned - URL requires authentication, skip for now
    # "anything-v5.0-pruned.safetensors")
    #   echo "https://huggingface.co/andite/anything-v4.0/resolve/main/anything-v5.0-pruned.safetensors"
    #   ;;
    "chilloutmix_NiPrunedFp32Fix.safetensors")
      echo "https://huggingface.co/TASUKU2023/Chilloutmix/resolve/main/chilloutmix_NiPrunedFp32Fix.safetensors"
      ;;
    "Realistic_Vision_V5.1_fp16-no-ema.safetensors")
      echo "https://huggingface.co/SG161222/Realistic_Vision_V5.1_noVAE/resolve/main/Realistic_Vision_V5.1_fp16-no-ema.safetensors"
      ;;
    "revAnimated_v122.safetensors")
      echo "https://huggingface.co/hanafuusen2001/ReVAnimated/resolve/main/revAnimated_v122.safetensors"
      ;;
    "sd-v1-5.safetensors"|"v1-5-pruned.safetensors")
      echo "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned.safetensors"
      ;;
    # Abstract/Artistic Models
    "openjourney-v4.safetensors")
      echo "https://huggingface.co/prompthero/openjourney/resolve/main/mdjrny-v4.safetensors"
      ;;
    "protogen-v2.2.safetensors")
      echo "https://huggingface.co/darkstorm2150/Protogen_v2.2_Official_Release/resolve/main/Protogen_V2.2.safetensors"
      ;;
    "analog-diffusion.safetensors")
      echo "https://huggingface.co/wavymulder/Analog-Diffusion/resolve/main/analog-diffusion-1.0.safetensors"
      ;;
    "inkpunk-diffusion.safetensors")
      echo "https://huggingface.co/Envvi/Inkpunk-Diffusion/resolve/main/inkpunk-diffusion.safetensors"
      ;;
    "pastel-mix.safetensors")
      echo "https://huggingface.co/andite/pastel-mix/resolve/main/pastelMix.safetensors"
      ;;
    "waifu-diffusion.safetensors")
      echo "https://huggingface.co/hakurei/waifu-diffusion/resolve/main/wd-1-4-anime_e2.safetensors"
      ;;
    "epic-diffusion.safetensors")
      echo "https://huggingface.co/xyn-ai/epic-diffusion/resolve/main/epicDiffusion.safetensors"
      ;;
    # SDArt_Complete_Edition - URL may be incorrect, skip for now
    # "SDArt_Complete_Edition.safetensors")
    #   echo "https://huggingface.co/Guizmus/SDArt_Complete_Edition/resolve/main/SDArt_Complete_Edition.safetensors"
    #   ;;
    *)
      echo ""
      ;;
  esac
}

# Find all checkpoint files (excluding symlinks, we'll check the actual files)
find . -maxdepth 1 -type f \( -name "*.safetensors" -o -name "*.ckpt" \) | while read -r file; do
  filename=$(basename "$file")
  
  # Get file size (works on both macOS and Linux)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    filesize=$(stat -f%z "$file" 2>/dev/null)
  else
    filesize=$(stat -c%s "$file" 2>/dev/null)
  fi
  
  if [ -z "$filesize" ]; then
    echo "⚠️  Could not get size for: $filename"
    continue
  fi
  
  # Check if file is too small (likely corrupted)
  if [ "$filesize" -lt "$MIN_SIZE" ]; then
    size_display=$(numfmt --to=iec-i --suffix=B "$filesize" 2>/dev/null || echo "${filesize} bytes")
    echo "❌ CORRUPTED: $filename (size: $size_display)"
    
    # Get download URL
    download_url=$(get_download_url "$filename")
    
    if [ -n "$download_url" ]; then
      echo "   📥 Re-downloading from: $download_url"
      rm -f "$file"
      
      # Download with curl
      if curl -L --progress-bar -o "$filename" "$download_url"; then
        # Check new file size
        if [[ "$OSTYPE" == "darwin"* ]]; then
          new_size=$(stat -f%z "$filename" 2>/dev/null)
        else
          new_size=$(stat -c%s "$filename" 2>/dev/null)
        fi
        
        if [ -n "$new_size" ] && [ "$new_size" -ge "$MIN_SIZE" ]; then
          new_size_display=$(numfmt --to=iec-i --suffix=B "$new_size" 2>/dev/null || echo "${new_size} bytes")
          echo "   ✅ Successfully re-downloaded: $filename (size: $new_size_display)"
        else
          echo "   ❌ Re-downloaded file still appears corrupted"
        fi
      else
        echo "   ❌ Failed to download"
      fi
    else
      echo "   ⚠️  No download URL found in registry. Please download manually."
    fi
    echo ""
  else
    size_display=$(numfmt --to=iec-i --suffix=B "$filesize" 2>/dev/null || echo "${filesize} bytes")
    echo "✅ OK: $filename (size: $size_display)"
  fi
done

echo ""
echo "Validation complete!"
