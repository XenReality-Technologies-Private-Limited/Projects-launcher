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
      isBinary = false, // when true: step chart + MATCH/NO MATCH labels + fill
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
    this.isBinary = isBinary;
  }

  setValues(values) {
    this.values = Array.isArray(values) ? values : [];
  }

  setCurrentIndex(index) {
    this.currentIndex = typeof index === 'number' && index >= 0 ? index : 0;
  }

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

    const paddingLeft = this.isBinary ? 62 : 8;
    const paddingRight = this.showLiveCount ? 24 : 8;
    const paddingTop = 12;
    const paddingBottom = 12;
    const innerWidth = width - paddingLeft - paddingRight;
    const innerHeight = height - paddingTop - paddingBottom;

    const maxIndex = windowValues.length - 1;
    const playheadX = width - paddingRight;

    ctx.save();

    // Binary mode: Y-axis labels + guide line + filled presence areas
    if (this.isBinary) {
      const matchY = paddingTop;
      const noMatchY = height - paddingBottom;

      ctx.fillStyle = '#9ca3af';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('MATCH', paddingLeft - 6, matchY);
      ctx.textBaseline = 'bottom';
      ctx.fillText('NO MATCH', paddingLeft - 6, noMatchY);

      // Dashed guide at MATCH level
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, paddingTop);
      ctx.lineTo(width - paddingRight, paddingTop);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill green behind each present segment
      if (maxIndex > 0) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.13)';
        let segStart = null;
        for (let i = 0; i <= maxIndex; i++) {
          const present = (windowValues[i] || 0) > 0;
          if (present && segStart === null) segStart = i;
          if (!present && segStart !== null) {
            const x1 = paddingLeft + (segStart / maxIndex) * innerWidth;
            const x2 = paddingLeft + (i / maxIndex) * innerWidth;
            ctx.fillRect(x1, paddingTop, x2 - x1, innerHeight);
            segStart = null;
          }
        }
        if (segStart !== null) {
          const x1 = paddingLeft + (segStart / maxIndex) * innerWidth;
          ctx.fillRect(x1, paddingTop, innerWidth - (x1 - paddingLeft), innerHeight);
        }
      }
    }

    // Draw baseline
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    // Draw the time series line (step chart when isBinary, smooth otherwise)
    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    let prevY = paddingTop + innerHeight;
    let lastY = paddingTop + innerHeight;
    windowValues.forEach((value, i) => {
      const clamped = Math.max(0, Math.min(this.yMax, value || 0));
      const x =
        paddingLeft +
        (maxIndex === 0 ? innerWidth / 2 : (i / maxIndex) * innerWidth);
      const y = paddingTop + innerHeight - (clamped / this.yMax) * innerHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else if (this.isBinary) {
        ctx.lineTo(x, prevY); // horizontal at previous height
        ctx.lineTo(x, y);     // vertical to new height (step)
      } else {
        ctx.lineTo(x, y);
      }
      prevY = y;
      lastY = y;
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
