#!/bin/bash

# Ollama Start Script for Development
# Checks if Ollama is running, starts it if not, then keeps running

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Handle SIGTERM gracefully
cleanup() {
    echo -e "\n${YELLOW}[ollama] Received termination signal, cleaning up...${NC}"
    # If we started ollama serve, it will handle its own cleanup
    exit 0
}

trap cleanup SIGTERM SIGINT

# Check if already running
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}[ollama] ✅ Already running${NC}"
    # Keep the script running so concurrently doesn't exit
    # Use a shorter sleep interval and check for signals
    while true; do
        sleep 5
        if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo -e "${YELLOW}[ollama] ⚠️  Connection lost, checking...${NC}"
        fi
    done
else
    echo -e "${YELLOW}[ollama] 🚀 Starting Ollama...${NC}"
    # Start ollama serve - this will keep running
    # Run in background and wait for it, so we can handle signals
    ollama serve &
    OLLAMA_PID=$!
    
    # Wait for ollama to be ready
    echo -e "${YELLOW}[ollama] Waiting for Ollama to be ready...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo -e "${GREEN}[ollama] ✅ Ollama is ready${NC}"
            break
        fi
        sleep 1
    done
    
    # Wait for the ollama process (or until we get a signal)
    wait $OLLAMA_PID || true
fi
