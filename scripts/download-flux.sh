#!/bin/bash
# Set up Flux.1 for ComfyUI on Apple Silicon (MPS): the ComfyUI-GGUF custom node,
# quantized dev + schnell UNets, the dual text encoders, and the Flux VAE.
# Quantized GGUF keeps memory sane on 32GB unified RAM (the fp8/fp16 builds thrash).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMFY="$ROOT/comfyui"

dl() { # url dest
  local url="$1" dest="$2" min="${3:-100000000}"
  mkdir -p "$(dirname "$dest")"
  if [ -f "$dest" ] && [ "$(wc -c < "$dest")" -gt "$min" ]; then
    echo "✅ $(basename "$dest") already present"; return
  fi
  echo "⬇️  $(basename "$dest")…"
  curl -L -m 2400 -o "$dest" "$url"
  [ "$(wc -c < "$dest")" -gt "$min" ] || { echo "❌ $(basename "$dest") too small — removing"; rm -f "$dest"; exit 1; }
}

# 1) ComfyUI-GGUF custom node + its python dep
if [ ! -d "$COMFY/custom_nodes/ComfyUI-GGUF" ]; then
  echo "⬇️  ComfyUI-GGUF node…"
  git clone --depth 1 https://github.com/city96/ComfyUI-GGUF.git "$COMFY/custom_nodes/ComfyUI-GGUF"
fi
"$COMFY/venv/bin/python" -m pip install --quiet --upgrade "gguf>=0.13.0" || true

# 2) Flux UNets (GGUF Q4_K_S — quality/dev + fast/schnell)
dl "https://huggingface.co/city96/FLUX.1-dev-gguf/resolve/main/flux1-dev-Q4_K_S.gguf"          "$COMFY/models/unet/flux1-dev-Q4_K_S.gguf"
dl "https://huggingface.co/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q4_K_S.gguf"  "$COMFY/models/unet/flux1-schnell-Q4_K_S.gguf"

# 3) Text encoders (shared by both) + VAE
dl "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors"              "$COMFY/models/clip/clip_l.safetensors"             10000000
dl "https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors"    "$COMFY/models/clip/t5xxl_fp8_e4m3fn.safetensors"
dl "https://huggingface.co/ffxvs/vae-flux/resolve/main/ae.safetensors"                                     "$COMFY/models/vae/ae.safetensors"                  10000000

echo "✅ Flux ready. Restart ComfyUI so it registers the GGUF node + models."
