#!/bin/bash

# ComfyUI Start Script for Development
# Starts ComfyUI with the correct Python environment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if already running
if curl -s http://localhost:8188/system_stats > /dev/null 2>&1; then
    echo -e "${GREEN}[comfyui] ✅ Already running${NC}"
    # Keep the script running so concurrently doesn't exit
    while true; do
        sleep 60
        if ! curl -s http://localhost:8188/system_stats > /dev/null 2>&1; then
            echo -e "${YELLOW}[comfyui] ⚠️  Connection lost, checking...${NC}"
        fi
    done
    exit 0
fi

# Check if ComfyUI is installed
if [ ! -d "$COMFYUI_DIR" ]; then
    echo -e "${RED}[comfyui] ❌ ComfyUI not installed!${NC}"
    echo -e "${RED}[comfyui] Run: npm run comfyui:setup${NC}"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "$COMFYUI_DIR/venv" ]; then
    echo -e "${RED}[comfyui] ❌ Virtual environment not found!${NC}"
    echo -e "${RED}[comfyui] Run: npm run comfyui:setup${NC}"
    exit 1
fi

echo -e "${YELLOW}[comfyui] 🚀 Starting ComfyUI on port 8188...${NC}"

# Change to ComfyUI directory and run with the venv Python
cd "$COMFYUI_DIR"
export PYTHONDONTWRITEBYTECODE=1
"$COMFYUI_DIR/venv/bin/python" -B main.py --port 8188
