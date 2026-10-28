// RGB histogram of the rendered photo, drawn additively so overlaps read as
// the mixed colour (white where all three channels agree).
export class Histogram {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bins = null;
  }

  update({ data }) {
    const r = new Uint32Array(256);
    const g = new Uint32Array(256);
    const b = new Uint32Array(256);
    const l = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      r[data[i]]++;
      g[data[i + 1]]++;
      b[data[i + 2]]++;
      l[Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])]++;
    }
    this.bins = { r, g, b, l };
    this.draw();
  }

  clear() {
    this.bins = null;
    this.draw();
  }

  draw() {
    const { canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);
    if (!this.bins) return;

    const { r, g, b, l } = this.bins;
    // Scale on the bulk of the data so a clipped bin does not flatten the rest.
    const values = [...r.slice(1, 255), ...g.slice(1, 255), ...b.slice(1, 255)].sort((x, y) => x - y);
    const peak = Math.max(1, values[Math.floor(values.length * 0.995)]);
    const y = (v) => height - Math.min(1, Math.sqrt(v / peak)) * (height - 2);

    const shape = (bins) => {
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * width, y(bins[i]));
      ctx.lineTo(width, height);
      ctx.closePath();
    };

    ctx.globalCompositeOperation = 'lighter';
    for (const [bins, color] of [[r, '#c8323c'], [g, '#2fa64a'], [b, '#3264d2']]) {
      shape(bins);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    shape(l);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = dpr;
    ctx.stroke();
  }
}
