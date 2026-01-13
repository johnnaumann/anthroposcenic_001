# Pipeline Testing Guide

## Important: Recreate Models After Modelfile Changes

After updating modelfiles, you MUST recreate the Ollama models:

```bash
# Recreate the describe model
npm run ollama:modelfile

# Recreate the transform model  
npm run ollama:modelfile:transform
```

## Pipeline Flow

1. **Upload** → Image uploaded, gets imageId
2. **Describe** → Ollama analyzes image, returns JSON with:
   - `description`: Visual description
   - `checkpoint`: Model name (e.g., Deliberate_v2.safetensors)
   - `sampler`: Sampler name (e.g., dpmpp_2m_karras)
   - `scheduler`: Scheduler (normal, karras, etc.)
   - `steps`: Number of steps
   - `cfgScale`: CFG scale value
   - `denoiseStrength`: Denoise strength
   - `negativePrompt`: Negative prompt text
3. **Transform** → Ollama transforms description using scientific analogies
4. **Process** → ComfyUI processes image with config from step 2

## Testing Checklist

### 1. Verify Models Exist
```bash
ollama list | grep anthroposcenic
```
Should show:
- `anthroposcenic-describe:latest`
- `anthroposcenic-transform:latest`

### 2. Test Describe Step
- Upload an image
- Check browser console for `[Describe]` logs
- Verify JSON is parsed correctly
- Check that config object has all required fields

### 3. Test Transform Step
- After describe completes, check `[CreativeTransform]` logs
- Verify original description is passed
- Check that transformed description is generated

### 4. Test Process Step
- Verify config is passed to ComfyUI
- Check that model is downloaded if needed
- Verify workflow is created with correct parameters

## Common Issues

### Issue: Empty JSON Response
**Symptom**: `[Describe] Raw response: ` (empty)
**Solution**: 
- Recreate the model: `npm run ollama:modelfile`
- Check that Ollama is running: `curl http://localhost:11434/api/tags`

### Issue: JSON Parse Error
**Symptom**: `Failed to parse JSON response`
**Solution**:
- Check `[Describe] Raw response` in logs
- Verify modelfile has JSON format instructions
- Recreate model after modelfile changes

### Issue: Transform Not Starting
**Symptom**: Component stuck, no logs
**Solution**:
- Check `[Page] Description complete` log to verify config has description
- Check `[CreativeTransform] Waiting for...` logs
- Verify `pipelineStep === 'transform'`

### Issue: Config Missing Fields
**Symptom**: `Missing or invalid required fields in JSON response`
**Solution**:
- Check modelfile has all field specifications
- Verify model was recreated after modelfile update
- Check raw response to see what fields are missing

## Debug Logs to Watch

### Describe Step
- `[Describe] Raw response length:` - Should be > 0
- `[Describe] Raw response preview:` - Should show JSON
- `[Describe] Successfully parsed JSON, keys:` - Should show all 8 keys
- `[Describe] Successfully parsed ComfyUI config:` - Final config object

### Transform Step
- `[CreativeTransform] Starting transformation with description length:` - Should be > 0
- `[Transform] Received request:` - Should show description preview

### Process Step
- `[ComfyUI Process] Checking for model:` - Model name
- `[ComfyUI Process] ✅ Model ready:` - Confirmation
