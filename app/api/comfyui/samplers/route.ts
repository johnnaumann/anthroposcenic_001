import { NextResponse } from 'next/server';
import { getAvailableSamplers } from '@/lib/comfyui';

/**
 * GET /api/comfyui/samplers
 * Returns list of available ComfyUI samplers
 */
export async function GET() {
  try {
    const samplers = await getAvailableSamplers();
    
    return NextResponse.json({
      samplers,
      count: samplers.length,
      note: 'These are the samplers currently available in your ComfyUI installation. To add more samplers, install custom nodes like "ComfyUI Extra Samplers" or "HybridSamplers".',
    });
  } catch (error) {
    console.error('Error getting samplers:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get samplers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
