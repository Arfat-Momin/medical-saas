export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

const SKIP_BYTES = 250 * 1024;
const MAX_EDGE   = 1600;
const QUALITY    = 0.75;

export async function compressImage(file: File): Promise<CompressedImage> {
  if (
    file.size <= SKIP_BYTES &&
    (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')
  ) {
    const { width, height } = await dimensions(file);
    return { blob: file, width, height };
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = fitInside(bitmap.width, bitmap.height, MAX_EDGE);

  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D is not supported in this browser');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image compression failed'))),
      'image/jpeg',
      QUALITY,
    );
  });

  return { blob, width, height };
}

function fitInside(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function dimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const out = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return out;
}