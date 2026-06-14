#!/bin/bash
# Download an ESRGAN upscale model used by the ComfyUI hires/detail pass.
# Default: 4x-UltraSharp (crisp, detail-oriented). Drop additional .pth models
# into comfyui/models/upscale_models/ and the workflow will auto-detect them.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST_DIR="$PROJECT_ROOT/comfyui/models/upscale_models"
MODEL_NAME="4x-UltraSharp.pth"
MODEL_URL="https://huggingface.co/lokCX/4x-Ultrasharp/resolve/main/4x-UltraSharp.pth"
MIN_BYTES=10000000 # 10MB sanity floor

mkdir -p "$DEST_DIR"
DEST="$DEST_DIR/$MODEL_NAME"

if [ -f "$DEST" ] && [ "$(wc -c < "$DEST")" -gt "$MIN_BYTES" ]; then
  echo "✅ $MODEL_NAME already present ($(du -h "$DEST" | cut -f1))"
  exit 0
fi

echo "⬇️  Downloading $MODEL_NAME ..."
curl -L -m 600 -o "$DEST" "$MODEL_URL"

SIZE=$(wc -c < "$DEST")
if [ "$SIZE" -lt "$MIN_BYTES" ]; then
  echo "❌ Download looks too small ($SIZE bytes) — likely an error page. Removing."
  rm -f "$DEST"
  exit 1
fi

echo "✅ Saved $MODEL_NAME ($(du -h "$DEST" | cut -f1)) to $DEST_DIR"
