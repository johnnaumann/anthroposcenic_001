#!/bin/bash

# Automated ComfyUI Memory Testing Script
# Runs tests automatically and captures logs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ComfyUI Automated Memory Testing${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if ComfyUI is installed
if [ ! -d "$COMFYUI_DIR" ]; then
    echo -e "${RED}❌ ComfyUI is not installed!${NC}"
    exit 1
fi

if [ ! -d "$COMFYUI_DIR/venv" ]; then
    echo -e "${RED}❌ Virtual environment not found!${NC}"
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

echo ""
echo -e "${YELLOW}Testing Memory Modes (automated)...${NC}"
echo "Logs will be saved to: $LOG_DIR"
echo ""

# Test modes in order from most to least memory intensive
MODES=("--normalvram" "--lowvram" "--novram" "--cpu")
MODE_NAMES=("Normal VRAM" "Low VRAM" "No VRAM (CPU)" "CPU Only")

for i in "${!MODES[@]}"; do
    MODE="${MODES[$i]}"
    MODE_NAME="${MODE_NAMES[$i]}"
    LOG_FILE="$LOG_DIR/comfyui-${MODE#--}.log"
    
    echo -e "${BLUE}----------------------------------------${NC}"
    echo -e "${BLUE}Testing: $MODE_NAME ($MODE)${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"
    
    # Kill any existing ComfyUI process
    pkill -f "python.*main.py" 2>/dev/null || true
    sleep 2
    
    echo -e "${GREEN}Starting ComfyUI with $MODE...${NC}"
    echo "Log file: $LOG_FILE"
    
    cd "$COMFYUI_DIR"
    export PYTHONDONTWRITEBYTECODE=1
    
    # Start ComfyUI in background with logging
    "$COMFYUI_DIR/venv/bin/python" -B main.py --port 8188 $MODE > "$LOG_FILE" 2>&1 &
    COMFYUI_PID=$!
    
    echo "ComfyUI PID: $COMFYUI_PID"
    echo "Waiting for initialization..."
    
    # Wait for ComfyUI to start (max 60 seconds)
    TIMEOUT=60
    ELAPSED=0
    STARTED=false
    
    while [ $ELAPSED -lt $TIMEOUT ]; do
        if curl -s http://localhost:8188/system_stats > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ComfyUI started successfully!${NC}"
            STARTED=true
            break
        fi
        
        # Check if process died
        if ! kill -0 $COMFYUI_PID 2>/dev/null; then
            echo -e "${RED}❌ ComfyUI process died during startup${NC}"
            break
        fi
        
        sleep 2
        ELAPSED=$((ELAPSED + 2))
        echo -n "."
    done
    echo ""
    
    if [ "$STARTED" = true ]; then
        # Get system stats
        echo -e "${YELLOW}System Stats:${NC}"
        STATS=$(curl -s http://localhost:8188/system_stats 2>/dev/null || echo "{}")
        echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"
        echo ""
        
        # Check for memory errors in logs
        echo -e "${YELLOW}Checking logs for errors...${NC}"
        if grep -i "out of memory\|OOM\|memory\|error" "$LOG_FILE" 2>/dev/null | head -10; then
            echo -e "${RED}⚠️  Found potential memory issues in logs${NC}"
        else
            echo -e "${GREEN}No obvious memory errors found${NC}"
        fi
        echo ""
        
        # Show last 20 lines of log
        echo -e "${YELLOW}Last 20 lines of log:${NC}"
        tail -20 "$LOG_FILE" 2>/dev/null || echo "Could not read log file"
        echo ""
        
        # Wait a bit to see if it stays stable
        echo "Monitoring for 10 seconds to check stability..."
        sleep 10
        
        if curl -s http://localhost:8188/system_stats > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ComfyUI is stable with $MODE_NAME mode${NC}"
        else
            echo -e "${RED}❌ ComfyUI became unresponsive${NC}"
        fi
    else
        echo -e "${RED}❌ ComfyUI failed to start with $MODE${NC}"
        echo -e "${YELLOW}Last 30 lines of error log:${NC}"
        tail -30 "$LOG_FILE" 2>/dev/null || echo "Could not read log file"
    fi
    
    # Stop ComfyUI
    echo ""
    echo -e "${YELLOW}Stopping ComfyUI...${NC}"
    kill $COMFYUI_PID 2>/dev/null || true
    sleep 3
    
    # Force kill if still running
    if kill -0 $COMFYUI_PID 2>/dev/null; then
        kill -9 $COMFYUI_PID 2>/dev/null || true
    fi
    
    # Make sure port is free
    sleep 2
    
    echo -e "${GREEN}✅ Test completed for $MODE_NAME${NC}"
    echo ""
    echo "Full log saved to: $LOG_FILE"
    echo ""
    
    # If this mode worked, we can optionally stop here
    if [ "$STARTED" = true ] && [ "$i" -eq 0 ]; then
        echo -e "${GREEN}Normal VRAM mode works! You may not need memory optimization.${NC}"
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All Tests Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Log files saved in: $LOG_DIR"
echo ""
echo "Review the logs to determine which mode works best:"
for i in "${!MODES[@]}"; do
    MODE="${MODES[$i]}"
    echo "  $LOG_DIR/comfyui-${MODE#--}.log"
done
