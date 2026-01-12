#!/bin/bash

# Anthroposcenic - Start All Services Script
# This script starts Ollama, ComfyUI, and Next.js concurrently
# and opens the browser when all services are ready

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Anthroposcenic - Starting All Services            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a service is running on a port
check_port() {
    local port=$1
    curl -s "http://localhost:$port" > /dev/null 2>&1
    return $?
}

# Function to wait for a service
wait_for_service() {
    local name=$1
    local url=$2
    local max_attempts=${3:-60}
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $name...${NC}"
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name is ready!${NC}"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    echo -e "${RED}❌ $name failed to start${NC}"
    return 1
}

# Check and start Ollama
echo -e "${BLUE}[1/3] Checking Ollama...${NC}"
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama is already running${NC}"
else
    echo -e "${YELLOW}🚀 Starting Ollama...${NC}"
    ollama serve > /tmp/ollama.log 2>&1 &
    OLLAMA_PID=$!
    echo "   PID: $OLLAMA_PID"
    wait_for_service "Ollama" "http://localhost:11434/api/tags" 30
fi

# Start ComfyUI
echo ""
echo -e "${BLUE}[2/3] Starting ComfyUI...${NC}"
if curl -s http://localhost:8188/system_stats > /dev/null 2>&1; then
    echo -e "${GREEN}✅ ComfyUI is already running${NC}"
else
    if [ ! -d "$COMFYUI_DIR/venv" ]; then
        echo -e "${RED}❌ ComfyUI virtual environment not found!${NC}"
        echo "   Run: npm run comfyui:setup"
        exit 1
    fi
    cd "$COMFYUI_DIR"
    "$COMFYUI_DIR/venv/bin/python" main.py --port 8188 > /tmp/comfyui.log 2>&1 &
    COMFYUI_PID=$!
    echo "   PID: $COMFYUI_PID"
    cd "$PROJECT_ROOT"
fi

# Start Next.js (this will be handled by concurrently in package.json)
echo ""
echo -e "${BLUE}[3/3] Next.js will start via npm...${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Services starting...${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BLUE}Ollama:${NC}   http://localhost:11434"
echo -e "  ${BLUE}ComfyUI:${NC}  http://localhost:8188"
echo -e "  ${BLUE}Next.js:${NC}  http://localhost:3000"
echo ""

# Export flag to indicate services are starting
export SERVICES_STARTING=true
