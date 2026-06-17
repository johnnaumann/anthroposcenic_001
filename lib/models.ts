import modelsConfig from '@/config/models.json';

export function getDefaultOllamaModel(): string {
  return modelsConfig.ollama.default;
}

export function isValidVisionModel(modelName: string): boolean {
  return modelName in modelsConfig.ollama.vision;
}
