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
      lineColor = '#2563eb',
      playheadColor = '#6b7280',
      yMax = 1,
      showLiveCount = false,
      showTimeLabels = false,
      showYLabels = false,
      fullRange = false,
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
    this.showTimeLabels = showTimeLabels;
    this.showYLabels = showYLabels;
    this.fullRange = fullRange;
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

    const totalEnd = this.values.length - 1;
    const end   = this.fullRange ? totalEnd : this.currentIndex;
    const start = this.fullRange ? 0 : Math.max(0, this.currentIndex - 59);
    // In fullRange mode, only draw data up to currentIndex (not future)
    const windowValues = this.fullRange
      ? this.values.slice(0, this.currentIndex + 1)
      : this.values.slice(start, this.currentIndex + 1);

    if (windowValues.length === 0) {
      return;
    }

    const paddingLeft = 8;
    const paddingRight = this.showYLabels ? 22 : (this.showLiveCount ? 28 : 8);
    const paddingTop = 8;
    const paddingBottom = this.showTimeLabels ? 22 : 8;
    const innerWidth = width - paddingLeft - paddingRight;
    const innerHeight = height - paddingTop - paddingBottom;

    const maxIndex = this.fullRange ? totalEnd : windowValues.length - 1;
    const playheadX = width - paddingRight;

    ctx.save();

    // Draw baseline
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    // Y-axis integer labels
    if (this.showYLabels && this.yMax > 0) {
      const maxInt = Math.ceil(this.yMax);
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${Math.round(height * 0.08)}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let v = 0; v <= maxInt; v++) {
        const y = paddingTop + innerHeight - (v / this.yMax) * innerHeight;
        ctx.fillText(String(v), width - paddingRight + 5, y);
      }
    }

    // Draw the time series line
    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    let lastY = paddingTop + innerHeight;
    windowValues.forEach((value, i) => {
      const clamped = Math.max(0, Math.min(this.yMax, value || 0));
      const xFrac = maxIndex === 0 ? 0.5
        : this.fullRange ? ((start + i) / totalEnd)
        : (i / maxIndex);
      const x = paddingLeft + xFrac * innerWidth;
      const y = paddingTop + innerHeight - (clamped / this.yMax) * innerHeight;
      lastY = y;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    if (this.showLiveCount && !this.showYLabels && windowValues.length > 0) {
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

    // X-axis time labels
    if (this.showTimeLabels) {
      const baselineY = height - paddingBottom;
      ctx.fillStyle = '#9ca3af';
      ctx.font = `${Math.round(height * 0.11)}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      const fmt   = t => `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
      const range = end - start || 1;
      const rightEdgeX = paddingLeft + innerWidth;

      if (this.fullRange) {
        // Fixed labels: 0:00 at left, every minute in between, total duration at right
        ctx.textAlign = 'left';
        ctx.fillText(fmt(0), paddingLeft, baselineY + 3);
        // every full minute — skip if too close to start or right edge
        for (let t = 60; t < end; t += 60) {
          const x = paddingLeft + (t / end) * innerWidth;
          if (x - paddingLeft < 36) continue; // too close to start label
          if (rightEdgeX - x < 48) continue;  // too close to end label
          ctx.textAlign = 'center';
          ctx.fillText(fmt(t), x, baselineY + 3);
        }
        // right edge = total duration
        ctx.textAlign = 'right';
        ctx.fillText(fmt(end), rightEdgeX, baselineY + 3);
      } else {
        // Sliding window labels
        ctx.textAlign = 'left';
        ctx.fillText(fmt(start), paddingLeft, baselineY + 3);
        const firstMin = Math.ceil((start + 1) / 60) * 60;
        for (let t = firstMin; t < end - 5; t += 60) {
          const frac = (t - start) / range;
          const x = paddingLeft + frac * innerWidth;
          ctx.textAlign = 'center';
          ctx.fillText(fmt(t), x, baselineY + 3);
        }
        ctx.textAlign = 'right';
        ctx.fillText(fmt(end), playheadX, baselineY + 3);
      }
    }

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
