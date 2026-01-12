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

# Activate virtual environment and run ComfyUI
echo "🚀 Starting ComfyUI..."
cd "$COMFYUI_DIR"
source venv/bin/activate

# Set default port if not specified
PORT=${COMFYUI_PORT:-8188}

echo "🌐 ComfyUI will be available at: http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""

python main.py --port "$PORT"
