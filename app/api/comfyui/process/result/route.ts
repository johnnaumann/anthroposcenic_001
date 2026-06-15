import { NextRequest, NextResponse } from 'next/server';
import {
  findLatestOutputImage,
  getAllComfyUIHistory,
  getComfyUIOutputImage,
} from '@/lib/comfyui';

export const dynamic = 'force-dynamic';

async function resolveOutputImage(
  promptId: string,
  jobStartTime: number
): Promise<string | null> {
  const history = await getAllComfyUIHistory();
  const jobData = history?.[promptId] as
    | {
        outputs?: Record<
          string,
          { images?: Array<{ filename: string; subfolder?: string }> }
        >;
      }
    | undefined;

  if (jobData?.outputs) {
    for (const nodeOutputs of Object.values(jobData.outputs)) {
      const image = nodeOutputs.images?.[0];
      if (image?.filename) {
        const subfolder = image.subfolder || '';
        const imagePath = subfolder ? `${subfolder}/${image.filename}` : image.filename;
        return getComfyUIOutputImage(imagePath);
      }
    }
  }

  const filesystemImage = await findLatestOutputImage(
    promptId,
    'anthroposcenic',
    jobStartTime
  );
  return filesystemImage?.imageUrl ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const promptId = request.nextUrl.searchParams.get('promptId');
    const sinceParam = request.nextUrl.searchParams.get('since');
    const jobStartTime = sinceParam ? parseInt(sinceParam, 10) : Date.now() - 600_000;

    if (!promptId) {
      return NextResponse.json({ error: 'promptId is required' }, { status: 400 });
    }

    const imageUrl = await resolveOutputImage(promptId, jobStartTime);
    if (!imageUrl) {
      return NextResponse.json({ error: 'Result not ready' }, { status: 404 });
    }

    return NextResponse.json({ imageUrl, promptId });
  } catch (error) {
    console.error('[Process Result] Error:', error);
    return NextResponse.json({ error: 'Failed to resolve process result' }, { status: 500 });
  }
}
