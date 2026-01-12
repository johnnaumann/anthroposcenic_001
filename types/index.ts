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

export interface DescribeStreamChunk {
  type: 'token' | 'thinking' | 'done' | 'error';
  content?: string;
  error?: string;
}

export interface ComfyUIProcessRequest {
  imageId: string;
  description: string;
  workflow?: string;
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
  onDescriptionComplete: (description: string) => void;
  disabled?: boolean;
}

export interface ComfyUIProgressProps {
  imageId: string | null;
  description: string | null;
  onProcessingComplete: (result: ComfyUIStreamChunk) => void;
  disabled?: boolean;
}

export interface PipelineStatusProps {
  step: 'upload' | 'describe' | 'process' | 'complete';
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
