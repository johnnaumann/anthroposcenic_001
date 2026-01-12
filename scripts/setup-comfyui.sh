#!/bin/bash

# ComfyUI Setup Script
# This script installs and sets up ComfyUI locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"

echo "🚀 Setting up ComfyUI..."

# Check if ComfyUI already exists
if [ -d "$COMFYUI_DIR" ]; then
    echo "⚠️  ComfyUI directory already exists at $COMFYUI_DIR"
    read -p "Do you want to remove it and reinstall? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing existing ComfyUI directory..."
        rm -rf "$COMFYUI_DIR"
    else
        echo "✅ Using existing ComfyUI installation"
        exit 0
    fi
fi

# Clone ComfyUI repository
echo "📥 Cloning ComfyUI repository..."
cd "$PROJECT_ROOT"
git clone https://github.com/comfyanonymous/ComfyUI.git comfyui

# Create virtual environment
echo "🐍 Creating Python virtual environment..."
cd "$COMFYUI_DIR"
python3 -m venv venv

# Activate virtual environment and install dependencies
echo "📦 Installing dependencies..."
source venv/bin/activate
pip install --upgrade pip

# Check Python version
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "Python version: $PYTHON_VERSION"

# Install PyTorch (CPU version by default, can be changed to CUDA if needed)
echo "Installing PyTorch..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install ComfyUI requirements (some packages may fail on older Python versions)
echo "Installing ComfyUI requirements..."
if ! pip install -r requirements.txt; then
    echo "⚠️  Some dependencies failed to install (this may be okay)"
    echo "Attempting to install core dependencies individually..."
    pip install aiohttp pyyaml pillow scipy tqdm psutil alembic SQLAlchemy || true
    pip install transformers tokenizers sentencepiece safetensors || true
    pip install einops torchsde || true
fi

echo "✅ ComfyUI setup complete!"
echo ""
echo "To run ComfyUI, use:"
echo "  cd $COMFYUI_DIR"
echo "  source venv/bin/activate"
echo "  python main.py"
echo ""
echo "Or use the provided run script: ./scripts/run-comfyui.sh"
