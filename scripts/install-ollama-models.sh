#!/bin/bash

# Ollama Models Installation Script
# Installs vision models from config/models.json

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/config/models.json"

echo "📦 Ollama Models Installation"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed!"
    echo "Please install Ollama first: ./scripts/setup-ollama.sh"
    exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "⚠️  Ollama is not running"
    echo "Starting Ollama..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
    
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "❌ Could not start Ollama"
        echo "Please run 'ollama serve' manually"
        exit 1
    fi
fi

echo "✅ Ollama is running"
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    exit 1
fi

# Get recommended models from config
echo "📋 Recommended models from config:"
echo ""

# Extract recommended models (simplified - in production, use jq or python)
# Default to qwen3-vl:8b which is available, fallback to others
RECOMMENDED_MODELS=("qwen3-vl:8b")

echo "The following models are recommended:"
for model in "${RECOMMENDED_MODELS[@]}"; do
    echo "  - $model"
done
echo ""

# Check which models are already installed
echo "🔍 Checking installed models..."
INSTALLED=$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' || echo "")

echo ""
echo "Installed models:"
if [ -z "$INSTALLED" ]; then
    echo "  (none)"
else
    echo "$INSTALLED" | while read -r model; do
        if [ ! -z "$model" ]; then
            echo "  ✅ $model"
        fi
    done
fi

echo ""

# Install recommended models
for model in "${RECOMMENDED_MODELS[@]}"; do
    if echo "$INSTALLED" | grep -q "^${model}$"; then
        echo "✅ $model is already installed"
    else
        echo ""
        echo "📥 Installing $model..."
        echo "This may take several minutes and requires significant download..."
        echo ""
        read -p "Install $model? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ollama pull "$model"
            echo "✅ $model installed successfully"
        else
            echo "⏭️  Skipped $model"
        fi
    fi
done

echo ""
echo "✅ Model installation complete!"
echo ""

# Create custom model from modelfile if base model is installed
echo "🔨 Creating custom model from modelfile..."
if [ -f "$PROJECT_ROOT/scripts/create-ollama-modelfile.sh" ]; then
    bash "$PROJECT_ROOT/scripts/create-ollama-modelfile.sh"
else
    echo "⚠️  Modelfile creation script not found, skipping custom model"
fi

echo ""
echo "Available models:"
ollama list
