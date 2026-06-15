import { NextRequest, NextResponse } from 'next/server';
import { isArchiveFilename } from '@/lib/output-archive';
import { serveOutputImageFile } from '@/lib/serve-output-image';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const filename = decodeURIComponent(params.filename);

  if (!isArchiveFilename(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const download = request.nextUrl.searchParams.get('download') === '1';
  return serveOutputImageFile(filename, { request, download });
}
