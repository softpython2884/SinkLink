// Full resolution export. Runs on its own WebGL context with the original
// bitmap, then encodes through a 2D canvas.
import { Renderer } from '../render/renderer.js';
import { scaledCanvas } from './loader.js';

export const EXPORT_FORMATS = {
  jpeg: { mime: 'image/jpeg', extension: 'jpg', label: 'JPEG', lossy: true, alpha: false },
  webp: { mime: 'image/webp', extension: 'webp', label: 'WebP', lossy: true, alpha: true },
  png: { mime: 'image/png', extension: 'png', label: 'PNG', lossy: false, alpha: true },
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

  const { mime, extension, alpha } = EXPORT_FORMATS[format];
  const out = document.createElement('canvas');
  out.width = result.width;
  out.height = result.height;
  const ctx = out.getContext('2d');
  const imageData = new ImageData(result.data, result.width, result.height);
  if (alpha) {
    ctx.putImageData(imageData, 0, 0);
  } else {
    // JPEG has no transparency: put a transparent stencil on white paper.
    const layer = document.createElement('canvas');
    layer.width = result.width;
    layer.height = result.height;
    layer.getContext('2d').putImageData(imageData, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(layer, 0, 0);
  }

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
