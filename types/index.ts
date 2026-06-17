// API Request/Response Types

export interface UploadResponse {
  imageId: string;
  imageUrl: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface OutputImageEntry {
  filename: string;
  imageUrl: string;
  createdAt: string;
  size: number;
}

export interface OutputImageListResponse {
  images: OutputImageEntry[];
}

export interface DescribeRequest {
  imageId?: string;
  imageIds?: string[];
  model?: string;
}

export interface ComfyUIConfig {
  description: string;
  checkpoint: string;
  sampler: string;
  scheduler: string;
  steps: number;
  cfgScale: number;
  denoiseStrength: number;
  negativePrompt: string;
  hiresFix?: boolean;
  hiresFactor?: number;
  hiresDenoise?: number;
  controlNet?: boolean;
  controlNetStrength?: number;
  freeU?: boolean;
  qualityBoost?: boolean;
}

export interface ComfyUIProcessRequest {
  imageId?: string;
  config: ComfyUIConfig;
  workflow?: string;
  useImage?: boolean;
  width?: number;
  height?: number;
}

export interface ProcessingProgressData {
  overall: number;
  phaseLabel: string;
  phaseIndex: number;
  phaseCount: number;
  stepProgress: number;
  step?: number;
  stepMax?: number;
}

export interface ComfyUIProgressUpdate {
  status: string;
  progress?: number;
  step?: number;
  stepMax?: number;
  executionComplete?: boolean;
  imageUrl?: string;
  error?: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface ComfyUIStatus {
  exec_info?: {
    queue_remaining?: number;
  };
  queue_running?: Array<[number, string, Record<string, unknown>, unknown, string[]]>;
  queue_pending?: Array<[number, string, Record<string, unknown>, unknown, string[]]>;
  status?: {
    exec_info?: {
      queue_remaining?: number;
    };
    queue_pending?: Array<[number, string, Record<string, unknown>, string]>;
  };
}
