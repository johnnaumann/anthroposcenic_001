# ComfyUI Memory Error Fix Summary

## Problem Identified

ComfyUI was running out of memory on macOS with the error:
```
MPS backend out of memory (MPS allocated: 23.98 GiB, other allocations: 496.00 KiB, max allowed: 36.27 GiB). Tried to allocate 7.60 GiB on private pool.
```

## Root Cause

Even with `--cpu` mode, PyTorch on macOS was still using MPS (Metal Performance Shaders) which shares unified memory with the system. Large images were consuming too much memory during VAE encoding.

## Fixes Applied

### 1. Disable MPS (Metal) Backend
Added environment variables to force CPU-only mode:
- `PYTORCH_ENABLE_MPS_FALLBACK=0`
- `PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0`
- `PYTORCH_MPS_ENABLE=0`

**Files modified:**
- `scripts/start-comfyui.sh`
- `scripts/run-comfyui.sh`

### 2. Image Resizing
Added automatic image resizing to limit dimensions before processing:
- Maximum width: 512px
- Maximum height: 512px
- Uses `ImageScale` node with Lanczos upscaling method

**Files modified:**
- `lib/comfyui.ts` - Added resize node to workflow
- `app/api/comfyui/process/route.ts` - Set max dimensions

### 3. Reduced Processing Steps
Reduced default sampling steps from 20 to 15 to reduce memory usage during processing.

**Files modified:**
- `lib/comfyui.ts` - Changed default steps from 20 to 15
- `app/api/comfyui/process/route.ts` - Updated workflow creation

## Expected Results

After these fixes:
- ComfyUI will use pure CPU mode (no MPS)
- Images will be automatically resized to 512x512 max before processing
- Processing will use fewer steps (15 instead of 20)
- Memory usage should be significantly reduced

## Testing

To test the fixes:
1. Restart ComfyUI: `npm run dev:comfyui` (or restart all services: `npm run dev`)
2. Upload an image and process it
3. Monitor memory usage - should stay well below 32GB limit

## Additional Optimizations (if still needed)

If memory issues persist:
1. Further reduce image size (e.g., 384x384)
2. Reduce steps to 10
3. Use smaller checkpoint models
4. Close other memory-intensive applications

## Notes

- The resize happens automatically in the workflow
- Image quality may be slightly reduced due to resizing, but processing will succeed
- CPU-only mode will be slower but more memory-efficient
