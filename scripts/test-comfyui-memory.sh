#!/bin/bash

# ComfyUI Memory Testing Script
# This script helps find the maximum memory ComfyUI can handle
# by testing different memory optimization modes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ComfyUI Memory Testing Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if ComfyUI is installed
if [ ! -d "$COMFYUI_DIR" ]; then
    echo -e "${RED}❌ ComfyUI is not installed!${NC}"
    echo "Run ./scripts/setup-comfyui.sh first"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "$COMFYUI_DIR/venv" ]; then
    echo -e "${RED}❌ Virtual environment not found!${NC}"
    echo "Run ./scripts/setup-comfyui.sh first"
    exit 1
fi

# Get system memory info
echo -e "${YELLOW}System Memory Information:${NC}"
if command -v sysctl &> /dev/null; then
    TOTAL_MEM=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
    if [ "$TOTAL_MEM" != "0" ]; then
        TOTAL_GB=$((TOTAL_MEM / 1024 / 1024 / 1024))
        echo "  Total RAM: ${TOTAL_GB} GB"
    fi
fi

# Check available memory
if command -v vm_stat &> /dev/null; then
    echo -e "${YELLOW}Current Memory Usage:${NC}"
    vm_stat | head -5
fi

echo ""
echo -e "${BLUE}Available Memory Modes:${NC}"
echo "  1. --normalvram  (Default - Normal VRAM usage)"
echo "  2. --lowvram     (Reduced VRAM - for GPUs with limited VRAM)"
echo "  3. --novram      (No VRAM - Use CPU instead of GPU)"
echo "  4. --cpu         (Force CPU mode - slowest but uses least memory)"
echo ""

# Test each mode
MODES=("--normalvram" "--lowvram" "--novram" "--cpu")
MODE_NAMES=("Normal VRAM" "Low VRAM" "No VRAM (CPU)" "CPU Only")

echo -e "${YELLOW}Testing Memory Modes:${NC}"
echo ""

for i in "${!MODES[@]}"; do
    MODE="${MODES[$i]}"
    MODE_NAME="${MODE_NAMES[$i]}"
    
    echo -e "${BLUE}----------------------------------------${NC}"
    echo -e "${BLUE}Testing: $MODE_NAME ($MODE)${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"
    
    # Check if ComfyUI is already running
    if curl -s http://localhost:8188/system_stats > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  ComfyUI is already running on port 8188${NC}"
        echo "Please stop it first before testing memory modes"
        echo ""
        read -p "Stop ComfyUI and continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping test..."
            continue
        fi
        pkill -f "python.*main.py" || true
        sleep 2
    fi
    
    echo -e "${GREEN}Starting ComfyUI with $MODE...${NC}"
    echo ""
    
    cd "$COMFYUI_DIR"
    export PYTHONDONTWRITEBYTECODE=1
    export COMFYUI_MEMORY_MODE="$MODE"
    
    # Start ComfyUI in background
    "$COMFYUI_DIR/venv/bin/python" -B main.py --port 8188 $MODE > /tmp/comfyui-test.log 2>&1 &
    COMFYUI_PID=$!
    
    echo "ComfyUI started with PID: $COMFYUI_PID"
    echo "Waiting for ComfyUI to initialize..."
    
    # Wait for ComfyUI to start (max 30 seconds)
    TIMEOUT=30
    ELAPSED=0
    while [ $ELAPSED -lt $TIMEOUT ]; do
        if curl -s http://localhost:8188/system_stats > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ComfyUI started successfully!${NC}"
            break
        fi
        sleep 1
        ELAPSED=$((ELAPSED + 1))
        echo -n "."
    done
    echo ""
    
    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo -e "${RED}❌ ComfyUI failed to start within $TIMEOUT seconds${NC}"
        echo "Check logs: /tmp/comfyui-test.log"
        kill $COMFYUI_PID 2>/dev/null || true
        continue
    fi
    
    # Check system stats
    echo -e "${YELLOW}System Stats:${NC}"
    curl -s http://localhost:8188/system_stats | python3 -m json.tool 2>/dev/null || echo "Could not parse system stats"
    echo ""
    
    # Ask user to test
    echo -e "${YELLOW}ComfyUI is running with $MODE_NAME mode${NC}"
    echo "You can now test it by:"
    echo "  1. Opening http://localhost:8188 in your browser"
    echo "  2. Submitting a test workflow"
    echo "  3. Monitoring memory usage"
    echo ""
    read -p "Press Enter when done testing (or 's' to skip to next mode)... " -r
    echo ""
    
    # Stop ComfyUI
    echo -e "${YELLOW}Stopping ComfyUI...${NC}"
    kill $COMFYUI_PID 2>/dev/null || true
    sleep 2
    
    # Make sure it's stopped
    if ps -p $COMFYUI_PID > /dev/null 2>&1; then
        kill -9 $COMFYUI_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Test completed for $MODE_NAME${NC}"
    echo ""
    
    # Ask if user wants to continue
    if [ $i -lt $((${#MODES[@]} - 1)) ]; then
        read -p "Continue to next mode? (Y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            echo "Stopping tests..."
            break
        fi
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Memory Testing Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "To use a specific memory mode, set the COMFYUI_MEMORY_MODE environment variable:"
echo "  export COMFYUI_MEMORY_MODE=--lowvram"
echo "  npm run dev:comfyui"
echo ""
echo "Or add it to your .env.local file:"
echo "  COMFYUI_MEMORY_MODE=--lowvram"
