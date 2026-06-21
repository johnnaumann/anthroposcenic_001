#!/bin/bash

# Pull the default Ollama vision model for describe (llava:7b).
# Describe prompt format lives in lib/describe-route.ts — no custom modelfile.

set -e

DEFAULT_MODEL="llava:7b"

echo "Pulling Ollama vision model for describe"
echo ""

if ! command -v ollama &> /dev/null; then
    echo "Ollama is not installed."
    echo "Install: https://ollama.com/download or brew install ollama"
    exit 1
fi

if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Ollama is not running. Starting..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Could not start Ollama. Run: ollama serve"
        exit 1
    fi
fi

echo "Pulling $DEFAULT_MODEL..."
ollama pull "$DEFAULT_MODEL"

echo ""
echo "Done. Default describe model: $DEFAULT_MODEL"
echo "Override with OLLAMA_MODEL in .env.local or model in /api/describe body."
echo "Verify: ollama list | grep llava"
