#!/bin/bash

# Ollama Setup Script
# This script helps verify and configure Ollama for local use

set -e

echo "🔍 Checking Ollama installation..."

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed!"
    echo ""
    echo "Please install Ollama first:"
    echo ""
    echo "  macOS:"
    echo "    brew install ollama"
    echo "    OR download from https://ollama.com/download"
    echo ""
    echo "  Linux:"
    echo "    curl -fsSL https://ollama.com/install.sh | sh"
    echo ""
    echo "  Windows:"
    echo "    Download from https://ollama.com/download"
    echo ""
    exit 1
fi

echo "✅ Ollama is installed"
echo ""

# Check if Ollama is running
echo "🔍 Checking if Ollama is running..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama is running on http://localhost:11434"
else
    echo "⚠️  Ollama is not running"
    echo ""
    echo "Starting Ollama..."
    echo "Note: On macOS/Linux, Ollama may run as a background service."
    echo "If it doesn't start automatically, run: ollama serve"
    echo ""
    
    # Try to start Ollama (may fail if already running or permission issues)
    ollama serve > /dev/null 2>&1 &
    sleep 2
    
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama started successfully"
    else
        echo "⚠️  Could not start Ollama automatically"
        echo "Please run 'ollama serve' manually in another terminal"
    fi
fi

echo ""
echo "📦 Checking installed models..."

# List installed models
MODELS=$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' || echo "")

if [ -z "$MODELS" ]; then
    echo "⚠️  No models installed"
    echo ""
    echo "To install recommended models, run:"
    echo "  npm run ollama:models"
    echo "  or"
    echo "  ./scripts/install-ollama-models.sh"
    echo ""
    echo "Or install manually:"
    echo "  ollama pull qwen2.5-vl:latest"
else
    echo "✅ Installed models:"
    echo "$MODELS" | while read -r model; do
        if [ ! -z "$model" ]; then
            echo "   - $model"
        fi
    done
    
    # Check if qwen3-vl:8b or qwen2.5-vl is installed
    if echo "$MODELS" | grep -q "qwen.*vl"; then
        echo ""
        echo "✅ Recommended Qwen vision model is installed"
    else
        echo ""
        echo "💡 Tip: Install recommended models with:"
        echo "   npm run ollama:models"
        echo "   or"
        echo "   ollama pull qwen3-vl:8b"
    fi
fi

echo ""
echo "✅ Ollama setup complete!"
echo ""
echo "Ollama is configured for local-only operation:"
echo "  - Host: http://localhost:11434"
echo "  - All processing happens on your machine"
echo "  - No external API calls"
echo "  - Complete privacy"
echo ""
echo "To verify, run: curl http://localhost:11434/api/tags"
