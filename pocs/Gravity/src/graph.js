export class TimeSeriesGraph {
  constructor(canvas, { lineColor = '#2563eb', playheadColor = '#6b7280', yMax = 1 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.values = [];
    this.currentIndex = 0;
    this.yMax = yMax;
    this.lineColor = lineColor;
    this.playheadColor = playheadColor;
  }
  setValues(values) { this.values = Array.isArray(values) ? values : []; }
  setCurrentIndex(index) { this.currentIndex = typeof index === 'number' && index >= 0 ? index : 0; }
  render() {
    const { canvas, ctx } = this;
    if (!canvas || !ctx) return;
    const width = canvas.width, height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    if (!this.values.length || this.yMax <= 0) return;
    const end = this.currentIndex, start = Math.max(0, end - 59);
    const windowValues = this.values.slice(start, end + 1);
    if (!windowValues.length) return;
    const pL = 8, pR = 8, pT = 8, pB = 8;
    const iW = width - pL - pR, iH = height - pT - pB;
    const maxIndex = windowValues.length - 1;
    ctx.save();
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pL, height - pB); ctx.lineTo(width - pR, height - pB); ctx.stroke();
    ctx.strokeStyle = this.lineColor; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.beginPath();
    windowValues.forEach((v, i) => {
      const clamped = Math.max(0, Math.min(this.yMax, v || 0));
      const x = pL + (maxIndex === 0 ? iW / 2 : (i / maxIndex) * iW);
      const y = pT + iH - (clamped / this.yMax) * iH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.strokeStyle = this.playheadColor; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(width - pR, pT); ctx.lineTo(width - pR, height - pB); ctx.stroke();
    ctx.restore();
  }
}

export class MultiSeriesGraph {
  constructor(canvas, { series = [], yMax = 10, playheadColor = '#6b7280', showLiveCount = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.series = series;
    this.currentIndex = 0;
    this.yMax = yMax;
    this.playheadColor = playheadColor;
    this.showLiveCount = showLiveCount;
  }
  setSeries(series) { this.series = Array.isArray(series) ? series : []; }
  setCurrentIndex(index) { this.currentIndex = typeof index === 'number' && index >= 0 ? index : 0; }
  render() {
    const { canvas, ctx } = this;
    if (!canvas || !ctx) return;
    const width = canvas.width, height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    if (!this.series.length || this.yMax <= 0) return;
    const end = this.currentIndex, start = Math.max(0, end - 59);
    const pL = 8, pR = this.showLiveCount ? 28 : 8, pT = 8, pB = 8;
    const iW = width - pL - pR, iH = height - pT - pB;
    const windowLen = end - start + 1, maxIndex = Math.max(0, windowLen - 1);
    const playheadX = width - pR;
    ctx.save();
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pL, height - pB); ctx.lineTo(playheadX, height - pB); ctx.stroke();
    this.series.forEach(({ values, color }) => {
      if (!values || !values.length) return;
      const wv = values.slice(start, end + 1);
      if (!wv.length) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.beginPath();
      let lastY = pT + iH;
      wv.forEach((v, i) => {
        const clamped = Math.max(0, Math.min(this.yMax, v || 0));
        const x = pL + (maxIndex === 0 ? iW / 2 : (i / maxIndex) * iW);
        const y = pT + iH - (clamped / this.yMax) * iH;
        lastY = y;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      if (this.showLiveCount && wv.length > 0) {
        const liveCount = Math.round(wv[wv.length - 1]);
        ctx.fillStyle = color;
        ctx.font = '13px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(liveCount), playheadX + 4, lastY);
      }
    });
    ctx.strokeStyle = this.playheadColor; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(playheadX, pT); ctx.lineTo(playheadX, height - pB); ctx.stroke();
    ctx.restore();
  }
}
