#!/bin/bash

# ComfyUI Run Script
# This script runs ComfyUI with the correct environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"

# Check if ComfyUI is installed
if [ ! -d "$COMFYUI_DIR" ]; then
    echo "❌ ComfyUI is not installed!"
    echo "Run ./scripts/setup-comfyui.sh first"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "$COMFYUI_DIR/venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Run ./scripts/setup-comfyui.sh first"
    exit 1
fi

# Set default port if not specified
PORT=${COMFYUI_PORT:-8188}

# Memory optimization flags
# Options: --lowvram (less VRAM), --novram (CPU only), --cpu (force CPU), --normalvram (default)
# On macOS, PyTorch is CPU-only, so --cpu mode is required
COMFYUI_MEMORY_MODE=${COMFYUI_MEMORY_MODE:-""}

# Auto-detect macOS and use CPU mode if no mode specified
if [ -z "$COMFYUI_MEMORY_MODE" ] && [[ "$OSTYPE" == "darwin"* ]]; then
    COMFYUI_MEMORY_MODE="--cpu"
fi

echo "🚀 Starting ComfyUI..."
echo "🌐 ComfyUI will be available at: http://localhost:$PORT"
if [ -n "$COMFYUI_MEMORY_MODE" ]; then
    echo "💾 Memory mode: $COMFYUI_MEMORY_MODE"
    if [[ "$COMFYUI_MEMORY_MODE" == "--cpu" ]]; then
        echo "💾 Additional optimization: --use-split-cross-attention"
    fi
fi
echo "Press Ctrl+C to stop"
echo ""

cd "$COMFYUI_DIR"

# Use absolute path to Python in venv to ensure correct environment
# Set PYTHONDONTWRITEBYTECODE to avoid cache issues
export PYTHONDONTWRITEBYTECODE=1

# Force CPU-only mode on macOS (disable MPS to prevent memory issues)
if [[ "$OSTYPE" == "darwin"* ]]; then
    export PYTORCH_ENABLE_MPS_FALLBACK=0
    export PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0
    # Disable MPS entirely to force CPU
    export PYTORCH_MPS_ENABLE=0
fi

# Build command with optional memory flags
# Add --use-split-cross-attention for additional memory optimization on CPU
CMD="$COMFYUI_DIR/venv/bin/python -B main.py --port $PORT"
if [ -n "$COMFYUI_MEMORY_MODE" ]; then
    CMD="$CMD $COMFYUI_MEMORY_MODE"
    # Add split cross attention for better memory usage on CPU
    if [[ "$COMFYUI_MEMORY_MODE" == "--cpu" ]]; then
        CMD="$CMD --use-split-cross-attention"
    fi
fi

eval "$CMD"
