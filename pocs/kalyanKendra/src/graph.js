// TimeSeriesGraph is responsible for rendering a 60-second sliding window
// of numeric data on a canvas, with a playhead at the right edge that matches
// the current video time (in seconds).
//
// The caller provides:
// - a numeric series (values array)
// - currentIndex (current second in the video)
// - a fixed yMax for scaling (e.g. 100 for Footfall, 20 for Apple Zone)

export class TimeSeriesGraph {
  constructor(
    canvas,
    {
      lineColor = '#2563eb', // primary blue by default
      playheadColor = '#6b7280', // neutral playhead
      yMax = 1,
      showLiveCount = false,
    } = {},
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.values = [];
    this.currentIndex = 0;
    this.yMax = yMax;
    this.lineColor = lineColor;
    this.playheadColor = playheadColor;
    this.showLiveCount = showLiveCount;
  }

  setValues(values) {
    this.values = Array.isArray(values) ? values : [];
  }

  setCurrentIndex(index) {
    this.currentIndex = typeof index === 'number' && index >= 0 ? index : 0;
  }

  // Optionally allow callers to replace or fill a specific point in the series
  // as new rolling-window counts are computed.
  setValueAt(index, value) {
    if (!Array.isArray(this.values)) {
      this.values = [];
    }
    if (index < 0) return;
    if (index >= this.values.length) {
      this.values.length = index + 1;
    }
    this.values[index] = value;
  }

  render() {
    const { canvas, ctx } = this;
    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!this.values || this.values.length === 0 || this.yMax <= 0) {
      return;
    }

    const end = this.currentIndex;
    const start = Math.max(0, end - 59);
    const windowValues = this.values.slice(start, end + 1);

    if (windowValues.length === 0) {
      return;
    }

    const paddingLeft = 8;
    const paddingRight = this.showLiveCount ? 24 : 8;
    const paddingTop = 8;
    const paddingBottom = 8;
    const innerWidth = width - paddingLeft - paddingRight;
    const innerHeight = height - paddingTop - paddingBottom;

    const maxIndex = windowValues.length - 1;
    const playheadX = width - paddingRight;

    ctx.save();

    // Draw baseline
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    // Draw the time series line
    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    let lastY = paddingTop + innerHeight;
    windowValues.forEach((value, i) => {
      const clamped = Math.max(0, Math.min(this.yMax, value || 0));
      const x =
        paddingLeft +
        (maxIndex === 0 ? innerWidth / 2 : (i / maxIndex) * innerWidth);
      const y = paddingTop + innerHeight - (clamped / this.yMax) * innerHeight;
      lastY = y;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    if (this.showLiveCount && windowValues.length > 0) {
      const liveCount = windowValues[windowValues.length - 1];
      ctx.fillStyle = this.lineColor;
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(liveCount), playheadX + 4, lastY);
    }

    // Draw playhead as a vertical dashed line at the right edge of the graph.
    ctx.strokeStyle = this.playheadColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(playheadX, paddingTop);
    ctx.lineTo(playheadX, height - paddingBottom);
    ctx.stroke();

    ctx.restore();
  }
}

// Multi-series 60s window graph: multiple lines (e.g. male, female, child) with shared yMax and playhead.
// Optional label per series (e.g. "Male") and showLiveCount: draw the current value at the end of each line.
export class MultiSeriesGraph {
  constructor(canvas, { series = [], yMax = 10, playheadColor = '#6b7280', showLiveCount = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.series = series; // [{ values: number[], color: string, label?: string }, ...]
    this.currentIndex = 0;
    this.yMax = yMax;
    this.playheadColor = playheadColor;
    this.showLiveCount = showLiveCount;
  }

  setSeries(series) {
    this.series = Array.isArray(series) ? series : [];
  }

  setCurrentIndex(index) {
    this.currentIndex = typeof index === 'number' && index >= 0 ? index : 0;
  }

  render() {
    const { canvas, ctx } = this;
    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (!this.series.length || this.yMax <= 0) return;

    const end = this.currentIndex;
    const start = Math.max(0, end - 59);
    const paddingLeft = 8;
    const paddingRight = 24;
    const paddingTop = 8;
    const paddingBottom = 8;
    const innerWidth = width - paddingLeft - paddingRight;
    const innerHeight = height - paddingTop - paddingBottom;

    ctx.save();

    // Baseline
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    const windowLen = end - start + 1;
    const maxIndex = Math.max(0, windowLen - 1);
    const playheadX = width - paddingRight;

    this.series.forEach(({ values, color, label }) => {
      if (!values || values.length === 0) return;
      const windowValues = values.slice(start, end + 1);
      if (windowValues.length === 0) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let lastY = paddingTop + innerHeight;
      windowValues.forEach((value, i) => {
        const clamped = Math.max(0, Math.min(this.yMax, value || 0));
        const x =
          paddingLeft +
          (maxIndex === 0 ? innerWidth / 2 : (i / maxIndex) * innerWidth);
        const y = paddingTop + innerHeight - (clamped / this.yMax) * innerHeight;
        lastY = y;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      if (this.showLiveCount && windowValues.length > 0) {
        const liveCount = Math.round(windowValues[windowValues.length - 1]);
        ctx.fillStyle = color;
        ctx.font = '16px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(liveCount), playheadX + 4, lastY);
      }
    });

    // Playhead at right edge
    ctx.strokeStyle = this.playheadColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(playheadX, paddingTop);
    ctx.lineTo(playheadX, height - paddingBottom);
    ctx.stroke();

    ctx.restore();
  }
}
