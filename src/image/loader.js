// Decoding and the downscaled copies used for the preview and for analysis.

export const PREVIEW_SIZE = 2560;
export const ANALYSIS_SIZE = 1024;

const SUPPORTED = /^image\/(jpeg|png|webp|gif|bmp|avif)$/;

export function isImageFile(file) {
  return file && (SUPPORTED.test(file.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name ?? ''));
}

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older engines: go through an <img>, which applies EXIF orientation too.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function scaledCanvas(source, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function loadImage(file, { previewSize = PREVIEW_SIZE } = {}) {
  const bitmap = await decode(file);
  const preview = scaledCanvas(bitmap, previewSize);
  const small = scaledCanvas(preview, ANALYSIS_SIZE);
  const analysis = small.getContext('2d').getImageData(0, 0, small.width, small.height);
  return {
    name: (file.name ?? 'photo').replace(/\.[^.]+$/, '') || 'photo',
    bitmap,
    preview,
    analysis,
    width: bitmap.width,
    height: bitmap.height,
  };
}
