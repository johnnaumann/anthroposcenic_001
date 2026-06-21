#!/bin/bash

# ComfyUI Setup Script
# Installs ComfyUI locally (clone + venv + PyTorch + requirements).
#
# Usage:
#   bash scripts/setup-comfyui.sh          # skip if venv is healthy
#   FORCE=1 bash scripts/setup-comfyui.sh  # remove and reinstall
#   PYTHON=python3.12 bash scripts/setup-comfyui.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"
FORCE="${FORCE:-0}"
SETUP_IN_PROGRESS=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
  esac
done

resolve_python() {
  if [ -n "${PYTHON:-}" ]; then
    if "$PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
      echo "$PYTHON"
      return 0
    fi
    echo "PYTHON=$PYTHON is not Python 3.10+" >&2
    return 1
  fi

  for cmd in python3.12 python3.11 python3.10 python3; do
    if command -v "$cmd" >/dev/null 2>&1 \
      && "$cmd" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
      echo "$cmd"
      return 0
    fi
  done

  echo "Python 3.10+ not found. Install Python or set PYTHON=python3.12" >&2
  echo "asdf users: run 'asdf install' from the project root (.tool-versions)." >&2
  return 1
}

comfyui_venv_ok() {
  [ -x "$COMFYUI_DIR/venv/bin/python" ] \
    && "$COMFYUI_DIR/venv/bin/python" -c "import torch" 2>/dev/null
}

cleanup_on_fail() {
  local code=$?
  if [ "$code" -ne 0 ] && [ "$SETUP_IN_PROGRESS" = "1" ] && [ -d "$COMFYUI_DIR" ]; then
    echo "Setup failed — removing incomplete $COMFYUI_DIR"
    rm -rf "$COMFYUI_DIR"
  fi
}

trap cleanup_on_fail EXIT

echo "Setting up ComfyUI..."

if [ -d "$COMFYUI_DIR" ]; then
  if comfyui_venv_ok && [ "$FORCE" != "1" ]; then
    echo "ComfyUI already installed at $COMFYUI_DIR"
    exit 0
  fi

  if [ "$FORCE" = "1" ]; then
    echo "Removing existing ComfyUI directory (--force / FORCE=1)..."
    rm -rf "$COMFYUI_DIR"
  elif [ -t 0 ]; then
    echo "ComfyUI directory exists at $COMFYUI_DIR but venv is missing or incomplete."
    read -p "Remove and reinstall? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      rm -rf "$COMFYUI_DIR"
    else
      echo "Re-run with FORCE=1 to reinstall non-interactively."
      exit 1
    fi
  else
    echo "ComfyUI directory exists but venv is incomplete. Re-run with FORCE=1." >&2
    exit 1
  fi
fi

PYTHON_BIN="$(resolve_python)"
echo "Using $PYTHON_BIN ($("$PYTHON_BIN" --version))"

SETUP_IN_PROGRESS=1

echo "Cloning ComfyUI repository..."
cd "$PROJECT_ROOT"
git clone https://github.com/comfyanonymous/ComfyUI.git comfyui

echo "Creating Python virtual environment..."
cd "$COMFYUI_DIR"
"$PYTHON_BIN" -m venv venv

echo "Installing dependencies..."
# shellcheck disable=SC1091
source venv/bin/activate
pip install --upgrade pip

PYTHON_VERSION=$(python --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "Python version: $PYTHON_VERSION"

echo "Installing PyTorch..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

echo "Installing ComfyUI requirements..."
if ! pip install -r requirements.txt; then
  echo "Some dependencies failed to install (this may be okay)"
  echo "Attempting to install core dependencies individually..."
  pip install aiohttp pyyaml pillow scipy tqdm psutil alembic SQLAlchemy || true
  pip install transformers tokenizers sentencepiece safetensors || true
  pip install einops torchsde || true
fi

if ! venv/bin/python -c "import torch" 2>/dev/null; then
  echo "ComfyUI venv is missing PyTorch — setup failed." >&2
  exit 1
fi

SETUP_IN_PROGRESS=0
trap - EXIT

echo "ComfyUI setup complete!"
echo ""
echo "To run ComfyUI:"
echo "  npm run comfyui:run"
echo ""
echo "Next: npm run setup:comfyui (includes Flux download) or bash scripts/download-flux.sh"
