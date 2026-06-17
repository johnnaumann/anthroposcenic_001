#!/bin/bash

# Wait for all services to be ready, then open browser
# This script is called by concurrently after services start

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}⏳ Waiting for all services to be ready...${NC}"

# Wait for services using wait-on (called from npm script)
# This script is called after wait-on succeeds

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🎉 All Services Ready! 🎉                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}App:${NC}      http://localhost:3000"
echo -e "  ${BLUE}Ollama:${NC}   http://localhost:11434"
echo -e "  ${BLUE}ComfyUI:${NC}  starts on first process (or: npm run comfyui:run)"
echo ""

# Open browser based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000 2>/dev/null || sensible-browser http://localhost:3000
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    start http://localhost:3000
fi

echo -e "${GREEN}🌐 Browser opened to http://localhost:3000${NC}"
echo ""
