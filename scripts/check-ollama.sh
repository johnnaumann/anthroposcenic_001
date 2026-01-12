#!/bin/bash

# Quick Ollama Health Check Script

echo "🔍 Checking Ollama status..."

# Check if Ollama command exists
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed"
    exit 1
fi

# Check if Ollama service is running
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama is running on http://localhost:11434"
    
    # Get model count
    MODEL_COUNT=$(ollama list 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
    echo "✅ Installed models: $MODEL_COUNT"
    
    # List models
    echo ""
    echo "Installed models:"
    ollama list 2>/dev/null | tail -n +2 | awk '{print "   - " $1}'
    
    exit 0
else
    echo "❌ Ollama is not running"
    echo ""
    echo "Start Ollama with: ollama serve"
    exit 1
fi
