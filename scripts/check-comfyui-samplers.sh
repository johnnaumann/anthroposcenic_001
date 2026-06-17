#!/bin/bash

# Check ComfyUI Available Samplers
# Lists all samplers currently available in ComfyUI

COMFYUI_HOST=${COMFYUI_HOST:-http://localhost:8188}

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}ComfyUI Sampler Checker${NC}"
echo "================================"
echo ""

# Check if ComfyUI is running
if ! curl -s "$COMFYUI_HOST/system_stats" > /dev/null 2>&1; then
    echo -e "${RED}❌ ComfyUI is not running${NC}"
    echo "   Start ComfyUI first: npm run comfyui:run"
    exit 1
fi

echo -e "${GREEN}✅ ComfyUI is running${NC}"
echo ""

# Get object_info to extract samplers
echo -e "${YELLOW}Fetching available samplers...${NC}"
OBJECT_INFO=$(curl -s "$COMFYUI_HOST/object_info" 2>/dev/null)

if [ -z "$OBJECT_INFO" ]; then
    echo -e "${RED}❌ Failed to get object_info from ComfyUI${NC}"
    exit 1
fi

# Parse samplers from object_info
SAMPLERS=$(echo "$OBJECT_INFO" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    ksampler_info = data.get('KSampler', {}).get('input', {}).get('required', {}).get('sampler_name', [])
    
    if isinstance(ksampler_info, list) and len(ksampler_info) > 0:
        # Check if first element is an array
        if isinstance(ksampler_info[0], list):
            samplers = ksampler_info[0]
        else:
            samplers = ksampler_info
        for sampler in samplers:
            print(sampler)
    else:
        print('No samplers found in object_info')
except Exception as e:
    print(f'Error parsing: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null)

if [ -z "$SAMPLERS" ] || [ "$SAMPLERS" = "No samplers found in object_info" ]; then
    echo -e "${RED}❌ Could not parse samplers from ComfyUI${NC}"
    echo "   Raw object_info (first 500 chars):"
    echo "$OBJECT_INFO" | head -c 500
    echo ""
    exit 1
fi

# Count samplers
SAMPLER_COUNT=$(echo "$SAMPLERS" | wc -l | tr -d ' ')

echo -e "${GREEN}Found ${SAMPLER_COUNT} available samplers:${NC}"
echo ""
echo "$SAMPLERS" | while read -r sampler; do
    echo -e "  ${BLUE}•${NC} $sampler"
done

echo ""
echo -e "${YELLOW}Note:${NC}"
echo "  These are the samplers built into ComfyUI core."
echo "  To add more samplers, install custom nodes:"
echo ""
echo "  1. ComfyUI Extra Samplers:"
echo "     https://github.com/Clybius/ComfyUI-Extra-Samplers"
echo ""
echo "  2. HybridSamplers for ComfyUI:"
echo "     https://github.com/azazeal04/ComfyUI-HybridSamplers"
echo ""
echo "  Install via ComfyUI Manager or manually in:"
echo "    comfyui/custom_nodes/"
