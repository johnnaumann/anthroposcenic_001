#!/bin/bash

# Ollama Start Script for Development
# Checks if Ollama is running, starts it if not, then keeps running

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if already running
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}[ollama] ✅ Already running${NC}"
    # Keep the script running so concurrently doesn't exit
    while true; do
        sleep 60
        if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo -e "${YELLOW}[ollama] ⚠️  Connection lost, checking...${NC}"
        fi
    done
else
    echo -e "${YELLOW}[ollama] 🚀 Starting Ollama...${NC}"
    # Start ollama serve - this will keep running
    ollama serve
fi
