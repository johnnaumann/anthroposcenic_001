#!/bin/bash

# Create Ollama Custom Model from Modelfile
# This script creates a custom model with a system prompt for image description

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODELLFILE="$PROJECT_ROOT/config/ollama-modelfile"
MODEL_NAME="anthroposcenic-describe:latest"

echo "📝 Creating Ollama Custom Model from Modelfile"
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

# Check if modelfile exists
if [ ! -f "$MODELLFILE" ]; then
    echo "❌ Modelfile not found: $MODELLFILE"
    exit 1
fi

echo "📄 Using modelfile: $MODELLFILE"
echo ""

# Check if base model is installed
BASE_MODEL=$(grep "^FROM" "$MODELLFILE" | awk '{print $2}' || echo "")
if [ -z "$BASE_MODEL" ]; then
    echo "❌ Could not find BASE_MODEL in modelfile"
    exit 1
fi

echo "🔍 Checking if base model '$BASE_MODEL' is installed..."
if ollama list 2>/dev/null | grep -q "^$BASE_MODEL"; then
    echo "✅ Base model '$BASE_MODEL' is installed"
else
    echo "⚠️  Base model '$BASE_MODEL' is not installed"
    echo "Pulling base model..."
    ollama pull "$BASE_MODEL"
    echo "✅ Base model installed"
fi

echo ""
echo "🔨 Creating custom model '$MODEL_NAME' from modelfile..."
echo ""

# Create model from modelfile
if ollama create "$MODEL_NAME" -f "$MODELLFILE"; then
    echo ""
    echo "✅ Custom model '$MODEL_NAME' created successfully!"
    echo ""
    echo "You can now use this model in the application."
    echo "It includes a system prompt optimized for image description."
    echo ""
    echo "To verify, run:"
    echo "  ollama list | grep $MODEL_NAME"
    echo ""
    echo "To test the model:"
    echo "  ollama run $MODEL_NAME 'Describe this image' --image <image_path>"
else
    echo ""
    echo "❌ Failed to create custom model"
    echo ""
    echo "If the model already exists, you can update it with:"
    echo "  ollama create $MODEL_NAME -f $MODELLFILE --force"
    exit 1
fi
