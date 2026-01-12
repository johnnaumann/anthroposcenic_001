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

echo "🚀 Starting ComfyUI..."
echo "🌐 ComfyUI will be available at: http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""

cd "$COMFYUI_DIR"

# Use absolute path to Python in venv to ensure correct environment
# Set PYTHONDONTWRITEBYTECODE to avoid cache issues
export PYTHONDONTWRITEBYTECODE=1
"$COMFYUI_DIR/venv/bin/python" -B main.py --port "$PORT"
