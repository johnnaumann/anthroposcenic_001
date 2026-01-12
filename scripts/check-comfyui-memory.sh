#!/bin/bash

# Quick ComfyUI Memory Check Script
# Checks current ComfyUI status and memory usage

COMFYUI_HOST=${COMFYUI_HOST:-http://localhost:8188}

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}ComfyUI Memory Status Check${NC}"
echo "================================"
echo ""

# Check if ComfyUI is running
if curl -s "$COMFYUI_HOST/system_stats" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ ComfyUI is running${NC}"
    echo ""
    
    # Get system stats
    echo -e "${YELLOW}System Stats:${NC}"
    STATS=$(curl -s "$COMFYUI_HOST/system_stats" 2>/dev/null)
    
    if [ -n "$STATS" ]; then
        echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"
    else
        echo "Could not retrieve system stats"
    fi
    echo ""
    
    # Check for memory-related errors in logs
    echo -e "${YELLOW}Checking for memory issues...${NC}"
    
    # Try to get queue status
    QUEUE=$(curl -s "$COMFYUI_HOST/queue" 2>/dev/null)
    if [ -n "$QUEUE" ]; then
        echo "Queue status: OK"
    fi
else
    echo -e "${RED}❌ ComfyUI is not running${NC}"
    echo ""
    echo "Start ComfyUI with:"
    echo "  npm run dev:comfyui"
    echo ""
    echo "Or test memory modes with:"
    echo "  npm run comfyui:test-memory"
    exit 1
fi

echo ""
echo -e "${BLUE}Memory Optimization Tips:${NC}"
echo ""
echo "If you're experiencing out-of-memory errors:"
echo ""
echo "1. Test different memory modes:"
echo "   npm run comfyui:test-memory"
echo ""
echo "2. Use low VRAM mode:"
echo "   export COMFYUI_MEMORY_MODE=--lowvram"
echo "   npm run dev:comfyui"
echo ""
echo "3. Use CPU mode (slowest but uses least memory):"
echo "   export COMFYUI_MEMORY_MODE=--cpu"
echo "   npm run dev:comfyui"
echo ""
echo "4. Add to .env.local for permanent setting:"
echo "   COMFYUI_MEMORY_MODE=--lowvram"
