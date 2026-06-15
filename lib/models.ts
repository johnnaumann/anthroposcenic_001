import modelsConfig from '@/config/models.json';

export interface OllamaModel {
  name: string;
  displayName: string;
  description: string;
  size: string;
  recommended: boolean;
  features: string[];
}

export interface ModelsConfig {
  ollama: {
    default: string;
    vision: Record<string, OllamaModel>;
  };
  comfyui: {
    defaultCheckpoint: string;
    checkpoints: string[];
  };
}

/**
 * Get the default Ollama model
 */
export function getDefaultOllamaModel(): string {
  return modelsConfig.ollama.default;
}

/**
 * Get all available vision models
 */
export function getAvailableVisionModels(): OllamaModel[] {
  return Object.values(modelsConfig.ollama.vision);
}

/**
 * Get a specific vision model by name
 */
export function getVisionModel(modelName: string): OllamaModel | undefined {
  return (modelsConfig as ModelsConfig).ollama.vision[modelName];
}

/**
 * Get recommended vision models
 */
export function getRecommendedVisionModels(): OllamaModel[] {
  return getAvailableVisionModels().filter(model => model.recommended);
}

/**
 * Check if a model name is valid
 */
export function isValidVisionModel(modelName: string): boolean {
  return modelName in modelsConfig.ollama.vision;
}

/**
 * Get model configuration
 */
export function getModelsConfig(): ModelsConfig {
  return modelsConfig as ModelsConfig;
}
