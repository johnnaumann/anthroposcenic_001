// API Request/Response Types

export interface UploadResponse {
  imageId: string;
  imageUrl: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface DescribeRequest {
  imageId: string;
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
  // Detail & refinement (optional; the workflow falls back to sensible defaults)
  hiresFix?: boolean; // run the upscale + refine pass
  hiresFactor?: number; // final upscale multiplier vs the base image
  hiresDenoise?: number; // refine-pass denoise (higher = more redrawn texture)
  controlNet?: boolean; // ControlNet Tile guidance on the refine pass
  controlNetStrength?: number; // how strongly the tile control holds structure
  freeU?: boolean; // FreeU detail/contrast boost
  qualityBoost?: boolean; // append photographic-detail prompt tags
}

export interface DescribeStreamChunk {
  type: 'token' | 'thinking' | 'done' | 'error';
  content?: string;
  config?: ComfyUIConfig;
  error?: string;
}

export interface ComfyUIProcessRequest {
  imageId?: string; // Optional - if not provided, uses text-to-image
  config: ComfyUIConfig;
  workflow?: string;
  useImage?: boolean; // Whether to use the uploaded image (img2img) or generate from scratch (txt2img)
  width?: number; // Image width for txt2img (default: 1024)
  height?: number; // Image height for txt2img (default: 1024)
}

export interface ComfyUIStreamChunk {
  type: 'status' | 'progress' | 'image' | 'done' | 'error';
  status?: string;
  progress?: number;
  imageUrl?: string;
  imageData?: string;
  error?: string;
}

// Component Props Types

export interface ImageUploadZoneProps {
  onUploadComplete: (response: UploadResponse) => void;
  disabled?: boolean;
}

export interface DescriptionStreamProps {
  imageId: string | null;
  onDescriptionComplete: (config: ComfyUIConfig) => void;
  disabled?: boolean;
}

export interface ComfyUIProgressProps {
  imageId: string | null;
  config: ComfyUIConfig | null;
  onProcessingComplete: (imageUrl: string) => void;
  disabled?: boolean;
}

export interface PipelineStatusProps {
  step: 'upload' | 'describe' | 'edit' | 'configure' | 'process' | 'complete';
  error?: string;
}

// Internal Types

export interface ImageStorage {
  id: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
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

export interface ComfyUIJob {
  prompt_id: string;
  number: number;
  node_errors?: Record<string, string[]>;
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
