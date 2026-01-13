#!/bin/bash

# Script to re-download DreamShaper_8.safetensors model

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKPOINTS_DIR="$PROJECT_ROOT/comfyui/models/checkpoints"
MODEL_NAME="DreamShaper_8.safetensors"
DOWNLOAD_URL="https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8.safetensors"

echo "Re-downloading DreamShaper 8 model..."
echo ""

# Create checkpoints directory if it doesn't exist
mkdir -p "$CHECKPOINTS_DIR"

# Remove existing file if it exists
if [ -f "$CHECKPOINTS_DIR/$MODEL_NAME" ]; then
  echo "Removing existing file: $MODEL_NAME"
  rm -f "$CHECKPOINTS_DIR/$MODEL_NAME"
fi

# Change to checkpoints directory
cd "$CHECKPOINTS_DIR"

echo "Starting download from: $DOWNLOAD_URL"
echo "This may take several minutes depending on your connection speed..."
echo ""

# Download using curl with progress bar
curl -L --progress-bar -o "$MODEL_NAME" "$DOWNLOAD_URL"

# Check if download was successful
if [ -f "$MODEL_NAME" ]; then
  FILE_SIZE=$(ls -lh "$MODEL_NAME" | awk '{print $5}')
  echo ""
  echo "✅ Successfully downloaded: $MODEL_NAME"
  echo "   File size: $FILE_SIZE"
  echo "   Location: $CHECKPOINTS_DIR/$MODEL_NAME"
else
  echo ""
  echo "❌ Download failed. Please try again or download manually."
  exit 1
fi
