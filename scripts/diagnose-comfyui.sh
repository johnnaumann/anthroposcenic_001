#!/bin/bash

# ComfyUI Diagnostic Script
# Helps identify bottlenecks and issues

COMFYUI_HOST=${COMFYUI_HOST:-http://localhost:8188}

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}ComfyUI Diagnostic Tool${NC}"
echo "================================"
echo ""

# Check if ComfyUI is running
if ! curl -s "$COMFYUI_HOST/system_stats" > /dev/null 2>&1; then
    echo -e "${RED}❌ ComfyUI is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✅ ComfyUI is running${NC}"
echo ""

# Get system stats
echo -e "${YELLOW}System Stats:${NC}"
STATS=$(curl -s "$COMFYUI_HOST/system_stats" 2>/dev/null)
if [ -n "$STATS" ]; then
    echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"
fi
echo ""

# Check queue
echo -e "${YELLOW}Queue Status:${NC}"
QUEUE=$(curl -s "$COMFYUI_HOST/queue" 2>/dev/null)
if [ -n "$QUEUE" ]; then
    echo "$QUEUE" | python3 -m json.tool 2>/dev/null || echo "$QUEUE"
fi
echo ""

# Check history (last 5 jobs)
echo -e "${YELLOW}Recent Job History:${NC}"
HISTORY=$(curl -s "$COMFYUI_HOST/history" 2>/dev/null)
if [ -n "$HISTORY" ]; then
    echo "$HISTORY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
count = 0
for prompt_id, job_data in list(data.items())[-5:]:
    count += 1
    print(f'\nJob {count}: {prompt_id}')
    if 'status' in job_data:
        status = job_data['status']
        if 'messages' in status:
            for msg in status['messages']:
                if isinstance(msg, list) and len(msg) > 0:
                    print(f'  Message: {msg[0]}')
        if 'node_errors' in status and status['node_errors']:
            print(f'  Errors: {status[\"node_errors\"]}')
    if 'outputs' in job_data:
        print(f'  Outputs: {len(job_data[\"outputs\"])} nodes')
" 2>/dev/null || echo "$HISTORY" | head -20
fi
echo ""

# Check available nodes
echo -e "${YELLOW}Checking for ImageScale node...${NC}"
OBJECT_INFO=$(curl -s "$COMFYUI_HOST/object_info" 2>/dev/null)
if [ -n "$OBJECT_INFO" ]; then
    if echo "$OBJECT_INFO" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if 'ImageScale' in data:
    print('✅ ImageScale node found')
    print(f'  Inputs: {list(data[\"ImageScale\"].get(\"input\", {}).keys())}')
elif 'ImageResize' in data:
    print('✅ ImageResize node found (alternative)')
    print(f'  Inputs: {list(data[\"ImageResize\"].get(\"input\", {}).keys())}')
else:
    print('❌ ImageScale node NOT found')
    print('Available image nodes:')
    for key in data.keys():
        if 'image' in key.lower() or 'Image' in key:
            print(f'  - {key}')
" 2>/dev/null; then
        :
    else
        echo "Could not parse object_info"
    fi
fi
echo ""

# Check output folder
echo -e "${YELLOW}Output Folder:${NC}"
OUTPUT_DIR="/Users/johnnaumann/Documents/GitHub/anthroposcenic_001/comfyui/output"
if [ -d "$OUTPUT_DIR" ]; then
    COUNT=$(find "$OUTPUT_DIR" -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | wc -l | tr -d ' ')
    echo "  Total images: $COUNT"
    echo "  Latest images:"
    find "$OUTPUT_DIR" -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | sort -r | head -5 | while read file; do
        SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "unknown")
        DATE=$(stat -f%Sm "$file" 2>/dev/null || stat -c%y "$file" 2>/dev/null || echo "unknown")
        echo "    - $(basename "$file") ($SIZE bytes, $DATE)"
    done
else
    echo "  Output directory not found"
fi
