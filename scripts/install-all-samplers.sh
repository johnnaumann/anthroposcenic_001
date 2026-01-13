#!/bin/bash

# Install All ComfyUI Samplers
# Installs multiple sampler packages to ensure maximum sampler availability

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFYUI_DIR="$PROJECT_ROOT/comfyui"
CUSTOM_NODES_DIR="$COMFYUI_DIR/custom_nodes"

echo "📦 Installing All ComfyUI Samplers"
echo "=================================="
echo ""

# Check if ComfyUI is installed
if [ ! -d "$COMFYUI_DIR" ]; then
    echo "❌ ComfyUI not found at: $COMFYUI_DIR"
    echo "   Run: npm run comfyui:setup"
    exit 1
fi

# Create custom_nodes directory if it doesn't exist
if [ ! -d "$CUSTOM_NODES_DIR" ]; then
    echo "📁 Creating custom_nodes directory..."
    mkdir -p "$CUSTOM_NODES_DIR"
fi

# Function to install a custom node
install_custom_node() {
    local name=$1
    local repo_url=$2
    local dir_name=$3
    local install_dir="$CUSTOM_NODES_DIR/$dir_name"
    local allow_failure=${4:-false}  # Optional 4th parameter to allow failures
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📥 Installing: $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ -d "$install_dir" ]; then
        echo "⚠️  Already installed: $name"
        echo "   Updating to latest version..."
        cd "$install_dir"
        if git pull > /dev/null 2>&1; then
            echo "✅ Updated: $name"
        else
            echo "⚠️  Update failed, but installation exists"
        fi
    else
        echo "   Repository: $repo_url"
        cd "$CUSTOM_NODES_DIR"
        
        if ! command -v git &> /dev/null; then
            echo "❌ Git is not installed"
            echo "   Please install git first"
            [ "$allow_failure" = "true" ] && return 0 || return 1
        fi
        
        echo "   Cloning..."
        if git clone "$repo_url" "$dir_name" 2>&1; then
            echo "✅ Installed: $name"
        else
            echo "❌ Failed to install: $name"
            if [ "$allow_failure" = "true" ]; then
                echo "⚠️  Skipping (not critical)"
                return 0
            else
                echo "   This may be due to network issues or repository access"
                echo "   You can try installing manually:"
                echo "   cd $CUSTOM_NODES_DIR && git clone $repo_url $dir_name"
                return 1
            fi
        fi
    fi
    
    # Install dependencies if requirements.txt exists
    if [ -f "$install_dir/requirements.txt" ]; then
        echo "   Installing dependencies..."
        cd "$COMFYUI_DIR"
        if [ -d "venv" ]; then
            "$COMFYUI_DIR/venv/bin/pip" install -q -r "$install_dir/requirements.txt" 2>/dev/null || {
                echo "⚠️  Some dependencies may have failed (this is often okay)"
            }
        else
            pip3 install -q -r "$install_dir/requirements.txt" 2>/dev/null || {
                echo "⚠️  Some dependencies may have failed (this is often okay)"
            }
        fi
        echo "✅ Dependencies installed"
    fi
}

# 1. ComfyUI Extra Samplers (Primary sampler extension)
install_custom_node \
    "ComfyUI Extra Samplers" \
    "https://github.com/Clybius/ComfyUI-Extra-Samplers.git" \
    "ComfyUI-Extra-Samplers"

# 2. ComfyUI HybridSamplers (Additional sampler variants)
install_custom_node \
    "ComfyUI HybridSamplers" \
    "https://github.com/azazeal04/ComfyUI-HybridSamplers.git" \
    "ComfyUI-HybridSamplers"

# 3. ComfyUI Switch Samplers (Dynamic sampler switching)
install_custom_node \
    "ComfyUI Switch Samplers" \
    "https://github.com/azazeal04/comfyui-switch-samplers.git" \
    "comfyui-switch-samplers"

# 4. ComfyUI Tiled KSampler (Tiled sampling for large images)
# Optional - provides tiled sampling capabilities
install_custom_node \
    "ComfyUI Tiled KSampler" \
    "https://github.com/BlenderNeko/ComfyUI_TiledKSampler.git" \
    "ComfyUI_TiledKSampler" \
    "true"  # Allow failure - not critical

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Sampler Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Installed sampler packages:"
if ls -1 "$CUSTOM_NODES_DIR" 2>/dev/null | grep -i sampler > /dev/null; then
    ls -1 "$CUSTOM_NODES_DIR" | grep -i sampler | while read -r dir; do
        echo "   • $dir"
    done
else
    echo "   (checking custom_nodes directory...)"
    ls -1 "$CUSTOM_NODES_DIR" 2>/dev/null | head -5 || echo "   (directory may be empty)"
fi
echo ""
echo "🔄 Next steps:"
echo "   1. Restart ComfyUI to load new samplers"
echo "   2. Check available samplers: npm run comfyui:samplers"
echo "   3. Or via API: curl http://localhost:8188/object_info | jq '.KSampler.input.required.sampler_name'"
echo ""
echo "💡 Note: After restarting ComfyUI, all new samplers will be available"
echo "   and the system will automatically detect them when Ollama suggests them."
echo ""
