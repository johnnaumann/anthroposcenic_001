#!/bin/bash
# Download the SD 1.5 ControlNet "Tile" model used by the refine pass to add
# crisp, structure-preserving detail. fp16 safetensors (~690MB).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST_DIR="$PROJECT_ROOT/comfyui/models/controlnet"
MODEL_NAME="control_v11f1e_sd15_tile_fp16.safetensors"
MODEL_URL="https://huggingface.co/comfyanonymous/ControlNet-v1-1_fp16_safetensors/resolve/main/control_v11f1e_sd15_tile_fp16.safetensors"
MIN_BYTES=100000000 # 100MB sanity floor

mkdir -p "$DEST_DIR"
DEST="$DEST_DIR/$MODEL_NAME"

if [ -f "$DEST" ] && [ "$(wc -c < "$DEST")" -gt "$MIN_BYTES" ]; then
  echo "✅ $MODEL_NAME already present ($(du -h "$DEST" | cut -f1))"
  exit 0
fi

echo "⬇️  Downloading $MODEL_NAME ..."
curl -L -m 900 -o "$DEST" "$MODEL_URL"

SIZE=$(wc -c < "$DEST")
if [ "$SIZE" -lt "$MIN_BYTES" ]; then
  echo "❌ Download looks too small ($SIZE bytes) — likely an error page. Removing."
  rm -f "$DEST"
  exit 1
fi

echo "✅ Saved $MODEL_NAME ($(du -h "$DEST" | cut -f1)) to $DEST_DIR"
