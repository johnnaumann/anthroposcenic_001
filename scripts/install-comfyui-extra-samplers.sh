#!/bin/bash

# Install ComfyUI Extra Samplers
# Adds additional samplers to ComfyUI via custom nodes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"
CUSTOM_NODES_DIR="$COMFYUI_DIR/custom_nodes"
EXTRA_SAMPLERS_DIR="$CUSTOM_NODES_DIR/ComfyUI-Extra-Samplers"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Installing ComfyUI Extra Samplers${NC}"
echo "========================================"
echo ""

# Check if ComfyUI is installed
if [ ! -d "$COMFYUI_DIR" ]; then
    echo -e "${RED}❌ ComfyUI not found at: $COMFYUI_DIR${NC}"
    echo "   Run: npm run comfyui:setup"
    exit 1
fi

# Create custom_nodes directory if it doesn't exist
if [ ! -d "$CUSTOM_NODES_DIR" ]; then
    echo -e "${YELLOW}Creating custom_nodes directory...${NC}"
    mkdir -p "$CUSTOM_NODES_DIR"
fi

# Check if already installed
if [ -d "$EXTRA_SAMPLERS_DIR" ]; then
    echo -e "${YELLOW}⚠️  ComfyUI Extra Samplers already installed${NC}"
    echo "   Location: $EXTRA_SAMPLERS_DIR"
    echo ""
    read -p "Update to latest version? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Updating ComfyUI Extra Samplers...${NC}"
        cd "$EXTRA_SAMPLERS_DIR"
        git pull
        echo -e "${GREEN}✅ Updated${NC}"
    else
        echo "Skipping update."
    fi
    exit 0
fi

# Install via git
echo -e "${YELLOW}Installing ComfyUI Extra Samplers...${NC}"
cd "$CUSTOM_NODES_DIR"

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed${NC}"
    echo "   Please install git first"
    exit 1
fi

echo "Cloning repository..."
git clone https://github.com/Clybius/ComfyUI-Extra-Samplers.git

if [ ! -d "$EXTRA_SAMPLERS_DIR" ]; then
    echo -e "${RED}❌ Installation failed${NC}"
    exit 1
fi

# Install dependencies if requirements.txt exists
if [ -f "$EXTRA_SAMPLERS_DIR/requirements.txt" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$COMFYUI_DIR"
    if [ -d "venv" ]; then
        "$COMFYUI_DIR/venv/bin/pip" install -r "$EXTRA_SAMPLERS_DIR/requirements.txt"
    else
        pip3 install -r "$EXTRA_SAMPLERS_DIR/requirements.txt"
    fi
fi

echo ""
echo -e "${GREEN}✅ ComfyUI Extra Samplers installed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Restart ComfyUI: npm run dev:comfyui"
echo "  2. Check available samplers: ./scripts/check-comfyui-samplers.sh"
echo "  3. Or via API: curl http://localhost:8188/object_info | jq '.KSampler.input.required.sampler_name'"
