// 60-second sliding window multi-series graph with playhead fixed at right edge.
// Mirrors the MultiSeriesGraph pattern from New_POC_Website/src/graph.js.
// currentIndex advances as the video plays; older data scrolls off the left.

export class SlidingWindowGraph {
  constructor(canvas, { series = [], yMax = 10 } = {}) {
    this.canvas       = canvas;
    this.ctx          = canvas.getContext('2d');
    this.series       = series; // [{ values: number[], color: string, label: string }]
    this.yMax         = yMax;
    this.currentIndex = 0;
  }

  setSeries(series) { this.series = Array.isArray(series) ? series : []; }
  setCurrentIndex(idx) { this.currentIndex = Math.max(0, idx); }

  render() {
    const { canvas, ctx, series, yMax } = this;
    if (!canvas || !ctx || !series.length || yMax <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== canvas.offsetWidth * dpr ||
        canvas.height !== canvas.offsetHeight * dpr) {
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    }

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    ctx.clearRect(0, 0, W, H);

    const padL = 8, padR = 24, padT = 8, padB = 8;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const end   = this.currentIndex;
    const start = Math.max(0, end - 59);
    const windowLen = end - start + 1;
    const maxIndex  = Math.max(0, windowLen - 1);
    const playheadX = W - padR;

    ctx.save();

    // Baseline
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - padB);
    ctx.lineTo(W - padR, H - padB);
    ctx.stroke();

    // Series lines
    series.forEach(({ values, color }) => {
      if (!values || values.length === 0) return;
      const windowValues = values.slice(start, end + 1);
      if (windowValues.length === 0) return;

      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.lineJoin    = 'round';
      ctx.beginPath();

      windowValues.forEach((value, i) => {
        const clamped = Math.max(0, Math.min(yMax, value || 0));
        const x = padL + (maxIndex === 0 ? innerW / 2 : (i / maxIndex) * innerW);
        const y = padT + innerH - (clamped / yMax) * innerH;
        if (i === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Playhead at right edge (dashed vertical line)
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(playheadX, padT);
    ctx.lineTo(playheadX, H - padB);
    ctx.stroke();

    ctx.restore();
  }
}
