import sharp from 'sharp';

const MAX_IMAGE_WIDTH = parseInt(process.env.MAX_IMAGE_WIDTH || '1024', 10);
const MAX_IMAGE_HEIGHT = parseInt(process.env.MAX_IMAGE_HEIGHT || '1024', 10);
const JPEG_QUALITY = parseInt(process.env.JPEG_QUALITY || '95', 10);
const PNG_QUALITY = parseInt(process.env.PNG_QUALITY || '95', 10);

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

export async function processUploadImageBuffer(
  inputBuffer: Buffer,
  preferPng: boolean
): Promise<ProcessedImage> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const hasTransparency = metadata.hasAlpha && preferPng;

  if (hasTransparency) {
    const buffer = await image
      .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ quality: PNG_QUALITY, compressionLevel: 9 })
      .toBuffer();

    return { buffer, mimeType: 'image/png', extension: 'png' };
  }

  const buffer = await image
    .resize(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return { buffer, mimeType: 'image/jpeg', extension: 'jpg' };
}
