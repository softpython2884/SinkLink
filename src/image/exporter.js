// Full resolution export. Runs on its own WebGL context with the original
// bitmap, then encodes through a 2D canvas.
import { Renderer } from '../render/renderer.js';
import { scaledCanvas } from './loader.js';

export const EXPORT_FORMATS = {
  jpeg: { mime: 'image/jpeg', extension: 'jpg', label: 'JPEG', lossy: true },
  webp: { mime: 'image/webp', extension: 'webp', label: 'WebP', lossy: true },
  png: { mime: 'image/png', extension: 'png', label: 'PNG', lossy: false },
};

export async function exportImage(image, edit, { format = 'jpeg', quality = 0.92, maxSize = Infinity } = {}) {
  const canvas = document.createElement('canvas');
  const pixels = image.width * image.height;
  const renderer = new Renderer(canvas, { highPrecision: pixels <= 16e6, maskSize: 4096 });
  let result;
  try {
    const limit = renderer.maxTextureSize;
    const source = Math.max(image.width, image.height) > limit ? scaledCanvas(image.bitmap, limit) : image.bitmap;
    renderer.setSource(source);
    result = renderer.renderPixels(edit, { maxSize });
  } finally {
    renderer.dispose();
  }

  const out = document.createElement('canvas');
  out.width = result.width;
  out.height = result.height;
  out.getContext('2d').putImageData(new ImageData(result.data, result.width, result.height), 0, 0);

  const { mime, extension } = EXPORT_FORMATS[format];
  const blob = await new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('Encodage impossible'))), mime, quality);
  });
  return { blob, width: result.width, height: result.height, filename: `${image.name}-sinklink.${extension}` };
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
