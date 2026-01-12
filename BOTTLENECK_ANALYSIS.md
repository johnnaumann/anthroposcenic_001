# ComfyUI Bottleneck Analysis

## Problem Summary

ComfyUI produces images **intermittently** - sometimes it works, sometimes it doesn't. 6 images were successfully produced (anthroposcenic_00001_ through 00006_), but many attempts fail.

## Root Causes Identified

### 1. **ImageScale Node Parameter Error** ⚠️ **FIXED**
- **Issue**: The workflow was using `images` (plural) but ImageScale expects `image` (singular)
- **Impact**: This would cause the workflow to fail immediately when trying to resize images
- **Fix**: Changed `images: [nodeIds.loadImage, 0]` to `image: [nodeIds.loadImage, 0]`

### 2. **Memory Issues** ⚠️ **PARTIALLY FIXED**
- **Issue**: MPS (Metal) backend running out of memory (23.98 GiB allocated, tried to allocate 7.60 GiB more)
- **Impact**: Large images cause out-of-memory errors during VAE encoding
- **Fixes Applied**:
  - Disabled MPS backend (PYTORCH_MPS_ENABLE=0)
  - Added image resizing to 512x512 max
  - Reduced steps from 20 to 15

### 3. **Error Handling Gaps**
- **Issue**: Some errors might not be properly caught or reported
- **Impact**: Failures appear silent to the user
- **Fix**: Improved error logging to show node errors in detail

## Bottleneck Factors

### Image Size
- **Large images** consume more memory during:
  - VAE encoding (image → latent space)
  - Processing in latent space
  - VAE decoding (latent → image)
- **Solution**: Automatic resizing to 512x512 max (now implemented)

### Memory State
- **Previous jobs** may leave models loaded in memory
- **Solution**: Restart ComfyUI between jobs if memory issues persist

### Processing Steps
- **More steps** = more memory usage during sampling
- **Solution**: Reduced from 20 to 15 steps

### Device Selection
- **MPS (Metal)** was using unified memory and hitting limits
- **Solution**: Force CPU-only mode on macOS

## Diagnostic Tools

Run the diagnostic script to check current state:
```bash
./scripts/diagnose-comfyui.sh
```

This will show:
- ComfyUI system stats
- Queue status
- Recent job history with errors
- Available nodes (verifies ImageScale exists)
- Output folder contents

## Expected Behavior After Fixes

1. **All images** should be automatically resized to 512x512 before processing
2. **Memory errors** should be eliminated (CPU-only mode)
3. **Workflow errors** should be properly reported with node details
4. **Success rate** should improve significantly

## If Issues Persist

1. **Check ComfyUI logs** for specific error messages
2. **Run diagnostic script** to see queue and history
3. **Verify image size** - even with resizing, very large source images might cause issues
4. **Reduce image size further** - try 384x384 if 512x512 still fails
5. **Reduce steps further** - try 10 steps instead of 15
6. **Check for model loading issues** - ensure checkpoint is properly loaded

## Monitoring

Watch for these indicators:
- ✅ **Success**: Image appears in `comfyui/output/` folder
- ❌ **Failure**: Error message in logs or "ComfyUI processing failed" in UI
- ⏱️ **Timeout**: Job takes > 10 minutes (check if it's actually processing)
