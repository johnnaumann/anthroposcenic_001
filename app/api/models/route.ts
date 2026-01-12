import { NextResponse } from 'next/server';
import { getAvailableVisionModels, getRecommendedVisionModels, getDefaultOllamaModel } from '@/lib/models';

/**
 * GET /api/models
 * Returns available Ollama models from configuration
 */
export async function GET() {
  try {
    const available = getAvailableVisionModels();
    const recommended = getRecommendedVisionModels();
    const defaultModel = getDefaultOllamaModel();

    return NextResponse.json({
      default: defaultModel,
      available: available,
      recommended: recommended,
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
