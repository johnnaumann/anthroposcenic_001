# Configuration Files

## models.json

This file defines the available Ollama models for the application.

### Structure

```json
{
  "ollama": {
    "default": "qwen2.5-vl:latest",
    "vision": {
      "model-name:tag": {
        "name": "model-name:tag",
        "displayName": "Display Name",
        "description": "Model description",
        "size": "~7GB",
        "recommended": true,
        "features": ["vision", "thinking"]
      }
    }
  }
}
```

### Adding New Models

1. Add the model entry to `ollama.vision`
2. Include all required fields
3. Set `recommended: true` if it should be auto-installed
4. Update the default model if needed

### Model Features

- `vision` - Can process images
- `thinking` - Shows reasoning process
- `fast` - Optimized for speed
- `high-quality` - Prioritizes quality over speed
- `detailed-descriptions` - Generates comprehensive descriptions

### Usage

Models are accessed via the `lib/models.ts` utility functions:
- `getDefaultOllamaModel()` - Get default model name
- `getAvailableVisionModels()` - Get all vision models
- `getRecommendedVisionModels()` - Get recommended models only
- `isValidVisionModel(name)` - Validate model name

### Installation

Models defined here can be installed using:
```bash
npm run ollama:models
```

This will install all models marked as `recommended: true`.
