import { clearPipelineConfig } from '@/lib/pipeline-config';
import { clearPipelineDescription } from '@/lib/pipeline-description';

export {
  savePipelineDescription,
  loadPipelineDescription,
} from '@/lib/pipeline-description';

export {
  savePipelineConfig,
  loadPipelineConfig,
  clearPipelineConfig,
} from '@/lib/pipeline-config';

export function clearPipelineState(): void {
  clearPipelineDescription();
  clearPipelineConfig();
}
