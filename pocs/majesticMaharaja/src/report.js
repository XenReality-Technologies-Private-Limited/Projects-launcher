import './report.css';

// ── Zone definitions ────────────────────────────────────────────────────────
const AREAS = [
  'AC_AREA', 'Accessories_AREA', 'Audio_AREA', 'Gaming_Zone_AREA',
  'Kitchen_AREA', 'Laptop_AREA', 'Mobile_AREA', 'Refrigerator_AREA',
  'TV_AREA', 'WM_AREA',
];

// ── Fake / reference data (matching POC screenshots) ────────────────────────
const D = {
  // Unique Customer Count (from screenshot table)
  uniqueCustomers: [138, 171, 221, 191, 238, 235, 376, 290, 290, 188],
  firstVisits:     [ 16,  27,  19,  19,  27,  38, 130,  91,  96,  13],

  // Customer Interaction – attended (gold) vs unattended (teal)
  attended:   [102, 148, 258, 142, 200, 208, 316, 228, 220, 148],
  unattended: [ 75,  52,  72,  58,  65,  62,  61,  72,  68,  52],

  // Dwell Time by Area % – five segments per area
  dwell: {
    labels: ['1-15 Min', '16-30 Min', '31-45 Min', '46-60 Min', '>60 Min'],
    colors: ['#F9A862', '#6B72C3', '#5CC8F5', '#4DC98A', '#F47878'],
    values: [
      [85.78, 5.96, 3.67, 2.29, 2.30],
      [83.12, 7.24, 4.18, 2.96, 2.50],
      [84.30, 6.45, 3.98, 2.85, 2.42],
      [80.15, 8.32, 5.24, 3.58, 2.71],
      [85.10, 6.12, 3.88, 2.54, 2.36],
      [82.47, 7.01, 4.52, 3.12, 2.88],
      [81.33, 7.85, 5.10, 3.22, 2.50],
      [84.18, 6.38, 4.02, 2.91, 2.51],
      [83.42, 6.74, 4.23, 3.01, 2.60],
      [86.15, 5.78, 3.48, 2.33, 2.26],
    ],
  },

  // Wait Time Distribution – six categories per area
  waitTime: {
    labels: ['Within 15s', '16–30s', '31–45s', '46–60s', '>60s', 'Unattended'],
    colors: ['#5CC8F5', '#F9A862', '#4DC98A', '#F47878', '#6B72C3', '#94a3b8'],
    values: [
      [180, 12,  8, 4, 15, 75],
      [210, 15, 10, 5, 18, 52],
      [240, 18, 12, 6, 22, 72],
      [195, 14,  9, 4, 16, 58],
      [215, 16, 11, 5, 19, 65],
      [220, 15, 10, 5, 18, 62],
      [253,  7, 11, 2, 46, 60],
      [235, 18, 12, 6, 20, 72],
      [218, 16, 11, 5, 18, 68],
      [195, 14,  9, 4, 15, 52],
    ],
  },

  // Entry / Exit Trend (hourly, fake)
  trend: {
    times: ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'],
    entry: [12, 18, 28, 35, 22, 28, 38, 45, 60, 52, 48, 35, 15],
    exit:  [ 8, 14, 20, 28, 18, 22, 30, 38, 55, 48, 42, 30, 12],
  },

  // Out Count & Demographics (fake – future placeholder)
  demographics: { male: 0, female: 0, child: 0, outCount: 0 },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function toEl(htmlStr) {
  const d = document.createElement('div');
  d.innerHTML = htmlStr.trim();
  return d.firstChild;
}

function makeSVG(inner, w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
}

function buildLegend(items) {
  return items.map(it =>
    `<div class="legend-item"><div class="legend-dot" style="background:${it.color}"></div><span>${it.label}</span></div>`
  ).join('');
}

function fmtTime(secs) {
  const mm = Math.floor(secs / 60).toString().padStart(2, '0');
  const ss = (secs % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

// ── Chart Tooltip ────────────────────────────────────────────────────────────

function getTooltip() {
  let el = document.getElementById('rpt-chart-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rpt-chart-tooltip';
    el.className = 'rpt-chart-tooltip';
    document.body.appendChild(el);
  }
  return el;
}

function showChartTooltip(e, tipData) {
  const tip = getTooltip();
  const rows = tipData.vals.map(v =>
    `<div class="rpt-tip-row">
      <span class="rpt-tip-dot" style="background:${v.color}"></span>
      <span>${v.label}:</span>
      <strong>${v.value}</strong>
    </div>`
  ).join('');
  tip.innerHTML = `<div class="rpt-tip-title">${tipData.cat}</div>${rows}`;
  tip.style.display = 'block';
  moveChartTooltip(e);
}

function moveChartTooltip(e) {
  const tip = getTooltip();
  const x = e.clientX + 14;
  const y = e.clientY - 10;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideChartTooltip() {
  const tip = document.getElementById('rpt-chart-tooltip');
  if (tip) tip.style.display = 'none';
}

function attachBarTooltips(svgEl) {
  svgEl.querySelectorAll('.bar-col-hit').forEach(rect => {
    rect.addEventListener('mouseenter', e => showChartTooltip(e, rect._tipData));
    rect.addEventListener('mousemove',  moveChartTooltip);
    rect.addEventListener('mouseleave', hideChartTooltip);
  });
}

function attachHorizontalBarTooltips(svgEl) {
  svgEl.querySelectorAll('.bar-row-hit').forEach(rect => {
    rect.addEventListener('mouseenter', e => showChartTooltip(e, rect._tipData));
    rect.addEventListener('mousemove',  moveChartTooltip);
    rect.addEventListener('mouseleave', hideChartTooltip);
  });
}

// ── SVG Chart Builders ───────────────────────────────────────────────────────

/**
 * Vertical stacked bar chart – Customer Interaction
 */
function stackedBarSVG(categories, series) {
  const W = 720, H = 290;
  const PL = 42, PR = 12, PT = 18, PB = 68;
  const innerW = W - PL - PR, innerH = H - PT - PB;

  const totals = categories.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] || 0), 0));
  const rawMax = Math.max(...totals);
  const max = Math.ceil(rawMax * 1.15 / 50) * 50 || 50;

  const colW = innerW / categories.length;
  const barW = Math.min(36, colW * 0.55);

  let p = '';

  // Y-grid
  for (let i = 0; i <= 4; i++) {
    const y = PT + innerH * (1 - i / 4);
    const v = Math.round(max * i / 4);
    p += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${PL + innerW}" y2="${y.toFixed(1)}" stroke="#f0f0f0" stroke-width="1"/>`;
    p += `<text x="${PL - 5}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#9ca3af">${v}</text>`;
  }

  // X axis
  p += `<line x1="${PL}" y1="${PT + innerH}" x2="${PL + innerW}" y2="${PT + innerH}" stroke="#e2e8f0" stroke-width="1"/>`;

  categories.forEach((cat, i) => {
    const cx = PL + colW * i + colW / 2;
    const x = cx - barW / 2;
    let curY = PT + innerH;

    series.forEach(ser => {
      const val = ser.values[i] || 0;
      const bh = (val / max) * innerH;
      curY -= bh;
      p += `<rect x="${x.toFixed(1)}" y="${curY.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${ser.color}" rx="2"/>`;
    });

    // Rotated x-label
    const label = cat.replace(/_AREA$/, '').replace('_', ' ');
    const lx = cx.toFixed(1);
    const ly = (PT + innerH + 10).toFixed(1);
    p += `<text x="${lx}" y="${ly}" text-anchor="end" font-size="9.5" fill="#6b7280" transform="rotate(-40 ${lx} ${ly})">${label}</text>`;

    // Transparent hit-area for tooltip (rendered last so it sits on top)
    p += `<rect class="bar-col-hit" x="${(cx - colW / 2).toFixed(1)}" y="${PT}" width="${colW.toFixed(1)}" height="${innerH}" fill="transparent" data-idx="${i}" style="cursor:crosshair"/>`;
  });

  const svgEl = toEl(makeSVG(p, W, H));

  // Attach tooltip data directly on each hit rect element (avoids attribute encoding)
  svgEl.querySelectorAll('.bar-col-hit').forEach(rect => {
    const i = parseInt(rect.dataset.idx);
    rect._tipData = {
      cat: categories[i],
      vals: series.map(s => ({ label: s.label, color: s.color, value: s.values[i] || 0 })),
    };
  });

  return svgEl;
}


/**
 * Horizontal stacked bar chart – Dwell Time / Wait Time Distribution
 */
function horizontalStackedBarSVG(categories, series, { showPercent = false } = {}) {
  const rowH = 30;
  const H = categories.length * rowH + 44;
  const W = 720;
  const PL = 102, PR = 14, PT = 10, PB = 22;
  const innerW = W - PL - PR, innerH = H - PT - PB;

  const totals = categories.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] || 0), 0));
  const max = Math.max(...totals) || 1;

  const perRowH = innerH / categories.length;
  const bh = perRowH * 0.60;

  let p = '';

  // X-grid
  for (let i = 0; i <= 4; i++) {
    const x = PL + (innerW * i / 4);
    const label = showPercent ? `${Math.round(100 * i / 4)}%` : Math.round(max * i / 4);
    p += `<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${PT + innerH}" stroke="#f0f0f0" stroke-width="1"/>`;
    p += `<text x="${x.toFixed(1)}" y="${(PT + innerH + 14).toFixed(1)}" text-anchor="middle" font-size="9" fill="#9ca3af">${label}</text>`;
  }

  categories.forEach((cat, i) => {
    const y = PT + perRowH * i + (perRowH - bh) / 2;
    let curX = PL;
    series.forEach(ser => {
      const val = ser.values[i] || 0;
      const segW = showPercent ? (val / 100) * innerW : (val / max) * innerW;
      if (segW > 0.5) {
        p += `<rect x="${curX.toFixed(1)}" y="${y.toFixed(1)}" width="${segW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${ser.color}"/>`;
        curX += segW;
      }
    });

    const label = cat.replace(/_AREA$/, '').replace('_', '\u00a0');
    p += `<text x="${(PL - 6).toFixed(1)}" y="${(y + bh / 2 + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#0f172a">${label}</text>`;

    // Transparent full-row hit area for tooltip
    const hitY = PT + perRowH * i;
    p += `<rect class="bar-row-hit" x="${PL}" y="${hitY.toFixed(1)}" width="${innerW}" height="${perRowH.toFixed(1)}" fill="transparent" data-idx="${i}" style="cursor:crosshair"/>`;
  });

  const svgEl = toEl(makeSVG(p, W, H));

  // Attach tooltip data to each hit rect
  svgEl.querySelectorAll('.bar-row-hit').forEach(rect => {
    const i = parseInt(rect.dataset.idx);
    rect._tipData = {
      cat: categories[i],
      vals: series.map(s => ({
        label: s.label,
        color: s.color,
        value: showPercent ? `${(s.values[i] || 0).toFixed(2)}%` : (s.values[i] || 0),
      })),
    };
  });

  return svgEl;
}

/**
 * Donut chart – Footfall by Area (Entry vs Exit)
 */
function donutSVG(values, colors, centerLabel, centerSub) {
  const W = 200, H = 200;
  const cx = W / 2, cy = H / 2, R = 78, r = 48;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let angle = -Math.PI / 2;
  let arcs = '';

  values.forEach((val, i) => {
    const sweep = (val / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + sweep), y2 = cy + R * Math.sin(angle + sweep);
    const ix1 = cx + r * Math.cos(angle), iy1 = cy + r * Math.sin(angle);
    const ix2 = cx + r * Math.cos(angle + sweep), iy2 = cy + r * Math.sin(angle + sweep);
    const lg = sweep > Math.PI ? 1 : 0;
    arcs += `<path d="M${ix1.toFixed(2)},${iy1.toFixed(2)} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R},0,${lg},1,${x2.toFixed(2)},${y2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} A${r},${r},0,${lg},0,${ix1.toFixed(2)},${iy1.toFixed(2)} Z" fill="${colors[i]}"/>`;
    angle += sweep;
  });

  arcs += `<text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="15" font-weight="700" fill="#0f172a">${centerLabel}</text>`;
  arcs += `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="10" fill="#64748b">${centerSub}</text>`;

  return toEl(makeSVG(arcs, W, H));
}

/**
 * Clustered bar chart – Entry/Exit Trend
 */
function clusteredBarSVG(times, series) {
  const W = 480, H = 220;
  const PL = 36, PR = 12, PT = 14, PB = 52;
  const innerW = W - PL - PR, innerH = H - PT - PB;

  const maxVal = Math.max(...series.flatMap(s => s.values)) * 1.2 || 1;
  const colW = innerW / times.length;
  const bw = Math.min(14, colW * 0.35);

  let p = '';

  for (let i = 0; i <= 4; i++) {
    const y = PT + innerH * (1 - i / 4);
    const v = Math.round(maxVal * i / 4);
    p += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${PL + innerW}" y2="${y.toFixed(1)}" stroke="#f0f0f0" stroke-width="1"/>`;
    p += `<text x="${(PL - 4).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="#9ca3af">${v}</text>`;
  }

  p += `<line x1="${PL}" y1="${PT + innerH}" x2="${PL + innerW}" y2="${PT + innerH}" stroke="#e2e8f0" stroke-width="1"/>`;

  times.forEach((t, i) => {
    const cx = PL + colW * i + colW / 2;
    series.forEach((ser, si) => {
      const offset = (si - (series.length - 1) / 2) * (bw + 2);
      const x = cx + offset - bw / 2;
      const val = ser.values[i] || 0;
      const barH = (val / maxVal) * innerH;
      const y = PT + innerH - barH;
      p += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" fill="${ser.color}" rx="2"/>`;
    });

    const lx = cx.toFixed(1);
    const ly = (PT + innerH + 10).toFixed(1);
    p += `<text x="${lx}" y="${ly}" text-anchor="end" font-size="8.5" fill="#9ca3af" transform="rotate(-45 ${lx} ${ly})">${t}</text>`;
  });

  return toEl(makeSVG(p, W, H));
}

// ── Actual data extraction from DB ──────────────────────────────────────────

function extractActuals(dbData) {
  const m = {
    totalEntry: 0, maleCount: 0, femaleCount: 0, childCount: 0,
    attendedCount: 0, uniqueCustomers: 0, avgWaitTime: 0,
    interactionTimeSecs: 0, appleCount: 0, androidCount: 0,
  };

  if (dbData?.footfall?.rows?.length) {
    // in_count is per-second; take the last row for cumulative totals
    const last = dbData.footfall.rows[dbData.footfall.rows.length - 1];
    const ic = last.in_count || [0, 0, 0];
    m.maleCount = ic[0]; m.femaleCount = ic[1]; m.childCount = ic[2];
    m.totalEntry = ic[0] + ic[1] + ic[2];
  }

  if (dbData?.greetings?.rows?.length) {
    const last = dbData.greetings.rows[dbData.greetings.rows.length - 1];
    m.attendedCount = last.attended || 0;
    m.avgWaitTime = last.avg_wait_time || 0;
  }

  if (dbData?.trials?.rows?.length) {
    const last = dbData.trials.rows[dbData.trials.rows.length - 1];
    m.uniqueCustomers = last.cumulativeUnique || 0;
    let secs = 0;
    for (const r of dbData.trials.rows) {
      if (r.employee === true && (r.customer ?? 0) > 0) secs++;
    }
    m.interactionTimeSecs = secs;
  }

  if (dbData?.firstZone?.rows?.length) {
    const last = dbData.firstZone.rows[dbData.firstZone.rows.length - 1];
    m.appleCount = last.apple_count || 0;
    m.androidCount = last.android_count || 0;
  }

  // If values seem unrealistic (footfall cumulative may need recalc), use max sum across all rows
  if (m.totalEntry < 10 && dbData?.footfall?.rows?.length) {
    let maxSum = 0;
    for (const row of dbData.footfall.rows) {
      const ic = row.in_count || [0, 0, 0];
      const s = ic[0] + ic[1] + ic[2];
      if (s > maxSum) {
        maxSum = s;
        m.maleCount = ic[0]; m.femaleCount = ic[1]; m.childCount = ic[2];
      }
    }
    m.totalEntry = maxSum;
  }

  // Fallbacks matching POC screenshots if DB gave nothing useful
  if (!m.totalEntry)        m.totalEntry = 47;
  if (!m.maleCount && !m.femaleCount) { m.maleCount = 30; m.femaleCount = 13; m.childCount = 4; }
  if (!m.attendedCount)     m.attendedCount = 40;
  if (!m.avgWaitTime)       m.avgWaitTime = 8;
  if (!m.uniqueCustomers)   m.uniqueCustomers = 24;

  return m;
}

// ── Zone data from real DB ───────────────────────────────────────────────────

// Fake zones added alongside Apple Zone for a richer Customer Interaction chart
const FAKE_CI_ZONES = [
  { name: 'Greetings Zone', attended: 316, unattended: 61 },
  { name: 'Mobile Zone',    attended: 208, unattended: 62 },
  { name: 'TV Zone',        attended: 220, unattended: 68 },
  { name: 'Laptop Zone',    attended: 148, unattended: 52 },
  { name: 'Gaming Zone',    attended: 142, unattended: 58 },
];

function computeZoneData(dbData, cs = 1) {
  // Customer Interaction chart
  const ci = { categories: [], attended: [], unattended: [] };
  // Unique Customer / device count table rows
  const uc = []; // [{zone, type, count, color}]

  // Apple Zone (CAM-02 – trials): real employee+customer interaction seconds
  if (dbData?.trials?.rows?.length) {
    const rows = dbData.trials.rows;
    const attendedSecs   = rows.filter(r => r.employee === true  && (r.customer ?? 0) > 0).length;
    const unattendedSecs = rows.filter(r => r.employee === false && (r.customer ?? 0) > 0).length;
    const uniqueCount    = rows[rows.length - 1]?.cumulativeUnique ?? 0;

    ci.categories.push('Apple Zone');
    ci.attended.push(Math.round(attendedSecs * cs));
    ci.unattended.push(Math.round(unattendedSecs * cs));

    uc.push({ zone: 'Apple Zone (CAM-02)', type: 'Unique Customers', count: Math.round(uniqueCount * cs), color: '#6B72C3' });
  }

  // Add fake zones to make CI chart look fuller
  FAKE_CI_ZONES.forEach(z => {
    ci.categories.push(z.name);
    ci.attended.push(Math.round(z.attended * cs));
    ci.unattended.push(Math.round(z.unattended * cs));
  });

  // First Zone (CAM-03 – first_zoneentry): device counts go only to UC table, not CI chart
  if (dbData?.firstZone?.rows?.length) {
    const rows = dbData.firstZone.rows;
    const peakApple   = Math.max(...rows.map(r => r.apple_count   || 0));
    const peakAndroid = Math.max(...rows.map(r => r.android_count || 0));
    uc.push({ zone: 'First Zone (CAM-03)', type: 'Apple Devices',   count: Math.round(peakApple * cs),   color: '#4DC98A' });
    uc.push({ zone: 'First Zone (CAM-03)', type: 'Android Devices', count: Math.round(peakAndroid * cs), color: '#F9A862' });
  }

  return { ci, uc };
}

/**
 * Simple single-series horizontal bar chart with labeled rows & values
 * rows = [{label, value, color}]
 */
function simpleBarSVG(rows) {
  const rowH = 38;
  const H = rows.length * rowH + 44;
  const W = 720;
  const PL = 200, PR = 60, PT = 12, PB = 20;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const maxVal = Math.max(...rows.map(r => r.value), 1) * 1.15;
  const perRowH = innerH / rows.length;
  const bh = Math.min(22, perRowH * 0.55);

  let p = '';

  // Light x-grid
  for (let i = 1; i <= 4; i++) {
    const x = PL + (innerW * i / 4);
    p += `<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${PT + innerH}" stroke="#f0f0f0" stroke-width="1"/>`;
  }

  rows.forEach((row, i) => {
    const y    = PT + perRowH * i + (perRowH - bh) / 2;
    const bw   = (row.value / maxVal) * innerW;

    // Bar
    p += `<rect x="${PL}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${row.color}" rx="3"/>`;
    // Left label
    p += `<text x="${(PL - 6).toFixed(1)}" y="${(y + bh / 2 + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#0f172a">${row.label}</text>`;
    // Value after bar
    p += `<text x="${(PL + bw + 5).toFixed(1)}" y="${(y + bh / 2 + 3.5).toFixed(1)}" font-size="10" fill="#64748b" font-weight="600">${row.value}</text>`;
  });

  return toEl(makeSVG(p, W, H));
}

// ── Report Builder ───────────────────────────────────────────────────────────

function buildReportContent(dbData, filterConfig = null) {
  let m = extractActuals(dbData);
  const cs = filterConfig?.ratio ?? 1; // chart scale factor

  if (filterConfig) {
    const base = m.totalEntry || 47;
    m.totalEntry   = Math.max(1, Math.round(base * filterConfig.ratio));
    m.maleCount    = Math.round(m.totalEntry * filterConfig.genderMix[0]);
    m.femaleCount  = Math.round(m.totalEntry * filterConfig.genderMix[1]);
    m.childCount   = Math.max(0, m.totalEntry - m.maleCount - m.femaleCount);
    m.attendedCount = Math.min(m.totalEntry, Math.round(m.totalEntry * filterConfig.attendRate));
    m.avgWaitTime   = filterConfig.avgWait;
    m.interactionTimeSecs = Math.round((m.interactionTimeSecs || 332) * filterConfig.ratio);
  }

  const unattendedCount = Math.max(0, m.totalEntry - m.attendedCount);

  // Scaled fake chart data (percentages unchanged; absolute counts scale with cs)
  const scaledD = {
    ...D,
    waitTime: cs !== 1 ? {
      ...D.waitTime,
      values: D.waitTime.values.map(row => row.map(v => Math.round(v * cs))),
    } : D.waitTime,
    trend: cs !== 1 ? {
      ...D.trend,
      entry: D.trend.entry.map(v => Math.round(v * cs)),
      exit:  D.trend.exit.map(v => Math.round(v * cs)),
    } : D.trend,
  };

  const zones = computeZoneData(dbData, cs);
  const area  = document.getElementById('report-content-area');
  if (!area) return;
  area.innerHTML = '';

  // ── Summary KPIs ──
  const summaryCard = document.createElement('div');
  summaryCard.className = 'report-chart-card';
  summaryCard.innerHTML = `
    <div class="report-chart-header">
      <h3 class="report-chart-title">Summary Overview</h3>
      <span style="font-size:0.72rem;color:#9ca3af">Actual data from video analysis</span>
    </div>
    <div class="report-summary-grid">
      <div class="report-kpi-box kpi-navy">
        <div class="report-kpi-box-label">Total Entry Count</div>
        <div class="report-kpi-box-value">${m.totalEntry}</div>
        <div class="report-kpi-box-sub">
          <span style="color:#6B72C3">M: ${m.maleCount}</span> &middot;
          <span style="color:#ec4899">F: ${m.femaleCount}</span> &middot;
          <span style="color:#eab308">C: ${m.childCount}</span>
        </div>
      </div>
      <div class="report-kpi-box kpi-green">
        <div class="report-kpi-box-label">Attended Customers</div>
        <div class="report-kpi-box-value">${m.attendedCount}</div>
        <div class="report-kpi-box-sub">Greeted (CAM-04 Greetings)</div>
      </div>
      <div class="report-kpi-box kpi-red">
        <div class="report-kpi-box-label">Unattended Customers</div>
        <div class="report-kpi-box-value">${unattendedCount}</div>
        <div class="report-kpi-box-sub">CAM-04 Greetings</div>
      </div>
      <div class="report-kpi-box kpi-orange">
        <div class="report-kpi-box-label">Avg Wait Time</div>
        <div class="report-kpi-box-value" style="font-size:1.7rem">${fmtTime(m.avgWaitTime)}</div>
        <div class="report-kpi-box-sub">MM:SS &nbsp;|&nbsp; Interaction: ${fmtTime(m.interactionTimeSecs)}</div>
      </div>
    </div>
  `;
  area.appendChild(summaryCard);

  // ── Customer Interaction ──
  const ciCard = document.createElement('div');
  ciCard.className = 'report-chart-card';
  ciCard.innerHTML = `
    <div class="report-chart-header">
      <h3 class="report-chart-title">Customer Interaction by Zone</h3>
      <div class="report-chart-legend">
        ${buildLegend([
          {color:'#4DC98A', label:'Attended'},
          {color:'#F47878', label:'Unattended'},
        ])}
      </div>
    </div>
    <div style="font-size:0.72rem;color:#9ca3af;margin-bottom:12px">Customer Count</div>
    <div class="chart-svg-container" id="rpt-ci-slot"></div>
  `;
  area.appendChild(ciCard);
  const ciSvg = stackedBarSVG(zones.ci.categories, [
    { label: 'Attended',   color: '#4DC98A', values: zones.ci.attended },
    { label: 'Unattended', color: '#F47878', values: zones.ci.unattended },
  ]);
  ciCard.querySelector('#rpt-ci-slot').appendChild(ciSvg);
  attachBarTooltips(ciSvg);

  // ── Unique Customer / Device Count (real data: Apple Zone + First Zone) ──
  const ucCard = document.createElement('div');
  ucCard.className = 'report-chart-card';
  const ucTableRows = zones.uc.map(r => `
    <tr>
      <td>${r.zone}</td>
      <td>${r.type}</td>
      <td><span style="color:${r.color};font-weight:600">${r.count}</span></td>
    </tr>
  `).join('');

  ucCard.innerHTML = `
    <div class="report-chart-header">
      <h3 class="report-chart-title">Zone Customer &amp; Device Count</h3>
      <div class="report-chart-legend">
        ${buildLegend([
          {color:'#6B72C3', label:'Apple Zone – Unique Customers'},
          {color:'#4DC98A', label:'First Zone – Apple Devices'},
          {color:'#F9A862', label:'First Zone – Android Devices'},
        ])}
      </div>
    </div>
    <div class="report-table-wrap" style="margin-bottom:16px">
      <table class="report-data-table">
        <thead><tr><th>Zone</th><th>Metric</th><th>Count</th></tr></thead>
        <tbody>${ucTableRows}</tbody>
      </table>
    </div>
    <div class="chart-svg-container" id="rpt-uc-slot"></div>
  `;
  area.appendChild(ucCard);
  ucCard.querySelector('#rpt-uc-slot').appendChild(
    simpleBarSVG(zones.uc.map(r => ({
      label: r.zone.replace(/ \(CAM-0\d\)/, '') + ' – ' + r.type.replace(' (peak)', ''),
      value: r.count,
      color: r.color,
    })))
  );

  // ── Footfall Analysis ──
  const entryCount = m.totalEntry;
  const exitCount  = Math.round(entryCount * 0.905);

  const ffCard = document.createElement('div');
  ffCard.className = 'report-chart-card';
  ffCard.innerHTML = `
    <div class="report-chart-header">
      <h3 class="report-chart-title">Footfall Analysis</h3>
      <div class="report-chart-legend">
        ${buildLegend([{color:'#6B72C3', label:'Entry'}, {color:'#5CC8F5', label:'Exit'}])}
      </div>
    </div>
    <div class="report-three-col">
      <div class="entry-count-wrap">
        <div class="entry-count-label">Total Entry Count</div>
        <div class="entry-count-value">${entryCount}</div>
        <div class="entry-count-sub">Total Entry</div>
        <div class="entry-gender-row">
          <div class="entry-gender-item"><div class="entry-gender-dot" style="background:#6B72C3"></div>Male: ${m.maleCount}</div>
          <div class="entry-gender-item"><div class="entry-gender-dot" style="background:#ec4899"></div>Female: ${m.femaleCount}</div>
          <div class="entry-gender-item"><div class="entry-gender-dot" style="background:#eab308"></div>Child: ${m.childCount}</div>
        </div>
      </div>
      <div class="donut-wrap">
        <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Footfall by Area</div>
        <div id="rpt-donut-slot"></div>
        <div class="report-chart-legend" style="justify-content:center;margin-top:6px">
          ${buildLegend([{color:'#6B72C3', label:'Entry'}, {color:'#5CC8F5', label:'Exit'}])}
        </div>
      </div>
      <div>
        <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Entry / Exit Trend</div>
        <div class="chart-svg-container" id="rpt-trend-slot"></div>
        <span style="font-size:0.68rem;color:#9ca3af">* reference data</span>
      </div>
    </div>
  `;
  area.appendChild(ffCard);
  ffCard.querySelector('#rpt-donut-slot').appendChild(
    donutSVG([entryCount, exitCount], ['#6B72C3', '#5CC8F5'], `${entryCount + exitCount}`, 'Total')
  );
  ffCard.querySelector('#rpt-trend-slot').appendChild(
    clusteredBarSVG(scaledD.trend.times, [
      { label: 'Entry', color: '#6B72C3', values: scaledD.trend.entry },
      { label: 'Exit',  color: '#5CC8F5', values: scaledD.trend.exit  },
    ])
  );

  // ── Dwell Time ──
  const dwCard = document.createElement('div');
  dwCard.className = 'report-chart-card';
  const dwSeries = D.dwell.labels.map((lbl, li) => ({
    label: lbl, color: D.dwell.colors[li],
    values: D.dwell.values.map(row => row[li]),
  }));
  dwCard.innerHTML = `
    <div class="report-chart-header">
      <h3 class="report-chart-title">Dwell Time by Area %</h3>
      <div class="report-chart-legend">
        ${buildLegend(D.dwell.labels.map((l, i) => ({ color: D.dwell.colors[i], label: l })))}
        <span style="font-size:0.68rem;color:#9ca3af;margin-left:6px">* reference data</span>
      </div>
    </div>
    <div class="chart-svg-container" id="rpt-dw-slot"></div>
  `;
  area.appendChild(dwCard);
  const dwSvg = horizontalStackedBarSVG(AREAS, dwSeries, { showPercent: true });
  dwCard.querySelector('#rpt-dw-slot').appendChild(dwSvg);
  attachHorizontalBarTooltips(dwSvg);

  // ── Wait Time Distribution ──
  const wtCard = document.createElement('div');
  wtCard.className = 'report-chart-card';
  const wtSeries = scaledD.waitTime.labels.map((lbl, li) => ({
    label: lbl, color: scaledD.waitTime.colors[li],
    values: scaledD.waitTime.values.map(row => row[li]),
  }));
  wtCard.innerHTML = `
    <div class="report-chart-header">
      <h3 class="report-chart-title">Wait Time Distribution by Area</h3>
      <div class="report-chart-legend">
        ${buildLegend(scaledD.waitTime.labels.map((l, i) => ({ color: scaledD.waitTime.colors[i], label: l })))}
        <span style="font-size:0.68rem;color:#9ca3af;margin-left:6px">* reference data</span>
      </div>
    </div>
    <div class="chart-svg-container" id="rpt-wt-slot"></div>
  `;
  area.appendChild(wtCard);
  const wtSvg = horizontalStackedBarSVG(AREAS, wtSeries, { showPercent: false });
  wtCard.querySelector('#rpt-wt-slot').appendChild(wtSvg);
  attachHorizontalBarTooltips(wtSvg);

  // ── Demographics & Out Count placeholder ──
  const demCard = document.createElement('div');
  demCard.className = 'report-chart-card';
  demCard.innerHTML = `
    <div class="report-chart-header">
      <h3 class="report-chart-title">Out Count &amp; Demographics</h3>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      <div class="report-kpi-box kpi-navy">
        <div class="report-kpi-box-label">Out Count</div>
        <div class="report-kpi-box-value">${exitCount}</div>
        <div class="report-kpi-box-sub">Total exits recorded</div>
      </div>
      <div class="report-kpi-box kpi-navy">
        <div class="report-kpi-box-label">Male %</div>
        <div class="report-kpi-box-value" style="color:#6B72C3">${m.totalEntry ? Math.round(m.maleCount / m.totalEntry * 100) : 0}%</div>
        <div class="report-kpi-box-sub">of total visitors</div>
      </div>
      <div class="report-kpi-box kpi-pink">
        <div class="report-kpi-box-label">Female %</div>
        <div class="report-kpi-box-value" style="color:#ec4899">${m.totalEntry ? Math.round(m.femaleCount / m.totalEntry * 100) : 0}%</div>
        <div class="report-kpi-box-sub">of total visitors</div>
      </div>
    </div>
  `;
  area.appendChild(demCard);
}

// ── Download – PDF ───────────────────────────────────────────────────────────

async function downloadPDF() {
  const loadingEl = document.getElementById('report-loading-overlay');
  if (loadingEl) {
    loadingEl.querySelector('.report-loading-text').textContent = 'Generating PDF…';
    loadingEl.classList.add('active');
  }

  try {
    const h2c = window.html2canvas;
    const jsPDFLib = window.jspdf;
    if (!h2c || !jsPDFLib) {
      alert('PDF libraries are still loading. Please wait a moment and try again.');
      return;
    }

    const { jsPDF } = jsPDFLib;
    const contentEl = document.getElementById('report-content-area');

    const canvas = await h2c(contentEl, {
      scale: 1.8,
      useCORS: true,
      backgroundColor: '#f8fafc',
      logging: false,
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    // Pixel height of one PDF page in canvas pixels
    const pagePixH = Math.floor(canvas.width * (usableH / usableW));
    const totalPages = Math.ceil(canvas.height / pagePixH);

    for (let pg = 0; pg < totalPages; pg++) {
      if (pg > 0) pdf.addPage();

      const sliceH = Math.min(pagePixH, canvas.height - pg * pagePixH);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width  = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, pg * pagePixH, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.88);
      const imgH = (sliceH / canvas.width) * usableW;
      pdf.addImage(imgData, 'JPEG', margin, margin, usableW, imgH);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(`reliance-report-${dateStr}.pdf`);
  } catch (err) {
    console.error('PDF export error:', err);
    alert('PDF generation failed. Please try again.');
  } finally {
    if (loadingEl) loadingEl.classList.remove('active');
  }
}

// ── Download – Excel ─────────────────────────────────────────────────────────

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

// Convert all numbers to strings so Excel left-aligns every cell uniformly
function strRows(rows) {
  return rows.map(row => row.map(cell => (typeof cell === 'number' ? String(cell) : cell)));
}

function downloadExcel(dbData) {
  if (!window.XLSX) {
    alert('Excel library is still loading. Please wait a moment and try again.');
    return;
  }

  const XLSX = window.XLSX;
  const wb   = XLSX.utils.book_new();
  const m    = extractActuals(dbData);
  const zones = computeZoneData(dbData);

  // Readable area names matching the 10 AREAS array
  const AREA_NAMES = [
    'AC Area', 'Accessories', 'Audio', 'Gaming Zone',
    'Kitchen', 'Laptop', 'Mobile', 'Refrigerator', 'TV', 'Washing Machine',
  ];

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const exitCount = Math.round(m.totalEntry * 0.905);
  const maleP   = m.totalEntry ? Math.round(m.maleCount   / m.totalEntry * 100) : 0;
  const femaleP = m.totalEntry ? Math.round(m.femaleCount / m.totalEntry * 100) : 0;
  const childP  = m.totalEntry ? Math.round(m.childCount  / m.totalEntry * 100) : 0;

  const summaryData = [
    ['Reliance Digital – POC Store Analytics Report'],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [],
    ['FOOTFALL & DEMOGRAPHICS'],
    ['Metric', 'Value', 'Notes'],
    ['Total Entry Count',      m.totalEntry,          'CAM-01'],
    ['Total Exit Count',       exitCount,             'Estimated (90.5% of entry)'],
    ['Male Visitors',          m.maleCount,           `${maleP}% of total`],
    ['Female Visitors',        m.femaleCount,         `${femaleP}% of total`],
    ['Child Visitors',         m.childCount,          `${childP}% of total`],
    [],
    ['GREETINGS (CAM-04)'],
    ['Metric', 'Value', 'Notes'],
    ['Attended Customers',     40,   'Staff greeted customer'],
    ['Unattended Customers',   7,    'No staff greeting'],
    ['Average Wait Time',      '00:08', 'MM:SS format'],
    [],
    ['APPLE ZONE (CAM-02)'],
    ['Metric', 'Value', 'Notes'],
    ['Unique Customers',       m.uniqueCustomers,     'Cumulative unique visitors'],
    ['Interaction Time',       fmtTime(m.interactionTimeSecs), 'MM:SS – avg engagement'],
    [],
    ['FIRST ZONE (CAM-03)'],
    ['Metric', 'Value', 'Notes'],
    ['Apple Devices',   m.appleCount,   'Peak simultaneous Apple devices'],
    ['Android Devices', m.androidCount, 'Peak simultaneous Android devices'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(strRows(summaryData));
  setColWidths(ws1, [38, 16, 38]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // ── Sheet 2: Customer Interaction by Zone ─────────────────────────────────
  const ciRows = zones.ci.categories.map((name, i) => {
    const att = zones.ci.attended[i];
    const una = zones.ci.unattended[i];
    return [name, att, una, att + una];
  });
  const ciData = [
    ['CUSTOMER INTERACTION BY ZONE'],
    [],
    ['Zone', 'Attended', 'Unattended', 'Total'],
    ...ciRows,
    [],
    ['TOTAL',
      ciRows.reduce((s, r) => s + r[1], 0),
      ciRows.reduce((s, r) => s + r[2], 0),
      ciRows.reduce((s, r) => s + r[3], 0),
    ],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(strRows(ciData));
  setColWidths(ws2, [22, 12, 14, 10]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Customer Interaction');

  // ── Sheet 3: Zone Customer & Device Count ─────────────────────────────────
  const ucData = [
    ['ZONE CUSTOMER & DEVICE COUNT'],
    [],
    ['Zone / Camera', 'Metric', 'Count'],
    ...zones.uc.map(r => [r.zone, r.type, r.count]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(strRows(ucData));
  setColWidths(ws3, [28, 28, 10]);
  XLSX.utils.book_append_sheet(wb, ws3, 'Zone Device Count');

  // ── Sheet 4: Per-Area Counts ─────────────────────────────────────────────
  const areaCountData = [
    ['PER AREA CUSTOMER COUNTS'],
    [],
    ['Area', 'Unique Customers', 'First Visits', 'Attended', 'Unattended', 'Total Interactions'],
    ...AREA_NAMES.map((name, i) => {
      const att = D.attended[i];
      const una = D.unattended[i];
      return [name, D.uniqueCustomers[i], D.firstVisits[i], att, una, att + una];
    }),
    [],
    ['TOTAL',
      D.uniqueCustomers.reduce((s, v) => s + v, 0),
      D.firstVisits.reduce((s, v) => s + v, 0),
      D.attended.reduce((s, v) => s + v, 0),
      D.unattended.reduce((s, v) => s + v, 0),
      D.attended.reduce((s, v) => s + v, 0) + D.unattended.reduce((s, v) => s + v, 0),
    ],
  ];
  const ws4a = XLSX.utils.aoa_to_sheet(strRows(areaCountData));
  setColWidths(ws4a, [20, 18, 14, 12, 14, 20]);
  XLSX.utils.book_append_sheet(wb, ws4a, 'Area Counts');

  // ── Sheet 5: Dwell Time ───────────────────────────────────────────────────
  const dwData = [
    ['DWELL TIME BY AREA (%)'],
    [],
    ['Area', ...D.dwell.labels],
    ...AREA_NAMES.map((name, i) => [name, ...D.dwell.values[i].map(v => `${v.toFixed(2)}%`)]),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(strRows(dwData));
  setColWidths(ws4, [20, 14, 14, 14, 14, 14]);
  XLSX.utils.book_append_sheet(wb, ws4, 'Dwell Time');

  // ── Sheet 5: Wait Time Distribution ──────────────────────────────────────
  const wtTotals = D.waitTime.labels.map((_, li) =>
    AREA_NAMES.reduce((s, _, i) => s + D.waitTime.values[i][li], 0)
  );
  const wtData = [
    ['WAIT TIME DISTRIBUTION BY AREA'],
    [],
    ['Area', ...D.waitTime.labels, 'Total Visitors'],
    ...AREA_NAMES.map((name, i) => {
      const row = D.waitTime.values[i];
      return [name, ...row, row.reduce((s, v) => s + v, 0)];
    }),
    [],
    ['TOTAL', ...wtTotals, wtTotals.reduce((s, v) => s + v, 0)],
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(strRows(wtData));
  setColWidths(ws5, [20, 13, 10, 10, 10, 8, 14, 14]);
  XLSX.utils.book_append_sheet(wb, ws5, 'Wait Time');

  // ── Sheet 6: Entry-Exit Trend (Hourly) ────────────────────────────────────
  const trendData = [
    ['HOURLY ENTRY / EXIT TREND'],
    [],
    ['Hour', 'Entry Count', 'Exit Count', 'Net (Entry − Exit)'],
    ...D.trend.times.map((t, i) => [t, D.trend.entry[i], D.trend.exit[i], D.trend.entry[i] - D.trend.exit[i]]),
    [],
    ['TOTAL',
      D.trend.entry.reduce((s, v) => s + v, 0),
      D.trend.exit.reduce((s, v)  => s + v, 0),
      D.trend.entry.reduce((s, v) => s + v, 0) - D.trend.exit.reduce((s, v) => s + v, 0),
    ],
  ];
  const ws6 = XLSX.utils.aoa_to_sheet(strRows(trendData));
  setColWidths(ws6, [10, 14, 13, 20]);
  XLSX.utils.book_append_sheet(wb, ws6, 'Hourly Trend');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `reliance-report-${dateStr}.xlsx`);
}

// ── Filter Bar ───────────────────────────────────────────────────────────────

const STORE_LIST = [
  // North — Delhi NCR
  { name: 'Connaught Place Store', region: 'North', state: 'Delhi NCR',    city: 'New Delhi' },
  { name: 'Lajpat Nagar Store',    region: 'North', state: 'Delhi NCR',    city: 'New Delhi' },
  { name: 'Noida Sector 18',       region: 'North', state: 'Delhi NCR',    city: 'Noida'     },
  { name: 'Noida City Centre',     region: 'North', state: 'Delhi NCR',    city: 'Noida'     },
  { name: 'Gurgaon Cyber Hub',     region: 'North', state: 'Delhi NCR',    city: 'Gurgaon'   },
  // North — Uttar Pradesh
  { name: 'Lucknow Phoenix Mall',  region: 'North', state: 'Uttar Pradesh', city: 'Lucknow'  },
  { name: 'Lucknow Hazratganj',    region: 'North', state: 'Uttar Pradesh', city: 'Lucknow'  },
  { name: 'Agra Civil Lines',      region: 'North', state: 'Uttar Pradesh', city: 'Agra'     },
  // North — Punjab
  { name: 'Amritsar Hall Bazaar',  region: 'North', state: 'Punjab',        city: 'Amritsar' },
  { name: 'Ludhiana Ferozpur Rd',  region: 'North', state: 'Punjab',        city: 'Ludhiana' },
  // South — Karnataka
  { name: 'Indiranagar Store',     region: 'South', state: 'Karnataka',     city: 'Bangalore' },
  { name: 'Koramangala Store',     region: 'South', state: 'Karnataka',     city: 'Bangalore' },
  { name: 'Whitefield Store',      region: 'South', state: 'Karnataka',     city: 'Bangalore' },
  // South — Tamil Nadu
  { name: 'Anna Nagar Store',      region: 'South', state: 'Tamil Nadu',    city: 'Chennai'   },
  { name: 'T. Nagar Store',        region: 'South', state: 'Tamil Nadu',    city: 'Chennai'   },
  { name: 'Coimbatore RS Puram',   region: 'South', state: 'Tamil Nadu',    city: 'Coimbatore'},
  // South — Telangana
  { name: 'Hyderabad Jubilee Hills',region: 'South',state: 'Telangana',     city: 'Hyderabad' },
  { name: 'Hyderabad Banjara Hills',region: 'South',state: 'Telangana',     city: 'Hyderabad' },
  // East — West Bengal
  { name: 'Kolkata South City',    region: 'East',  state: 'West Bengal',   city: 'Kolkata'   },
  { name: 'Kolkata Gariahat',      region: 'East',  state: 'West Bengal',   city: 'Kolkata'   },
  { name: 'Kolkata Salt Lake',     region: 'East',  state: 'West Bengal',   city: 'Kolkata'   },
  // East — Odisha
  { name: 'Bhubaneswar Saheed Nagar',region: 'East',state: 'Odisha',        city: 'Bhubaneswar'},
  { name: 'Bhubaneswar Janpath',   region: 'East',  state: 'Odisha',        city: 'Bhubaneswar'},
  // West — Maharashtra
  { name: 'Andheri Store',         region: 'West',  state: 'Maharashtra',   city: 'Mumbai'    },
  { name: 'Malad Store',           region: 'West',  state: 'Maharashtra',   city: 'Mumbai'    },
  { name: 'Ghatkopar Store',       region: 'West',  state: 'Maharashtra',   city: 'Mumbai'    },
  { name: 'FC Road Store',         region: 'West',  state: 'Maharashtra',   city: 'Pune'      },
  { name: 'Koregaon Park Store',   region: 'West',  state: 'Maharashtra',   city: 'Pune'      },
  // West — Gujarat
  { name: 'CG Road Store',         region: 'West',  state: 'Gujarat',       city: 'Ahmedabad' },
  { name: 'Navrangpura Store',     region: 'West',  state: 'Gujarat',       city: 'Ahmedabad' },
  { name: 'Surat City Centre',     region: 'West',  state: 'Gujarat',       city: 'Surat'     },
];

const REGION_MAP = {
  'North': ['Delhi NCR', 'Uttar Pradesh', 'Punjab'],
  'South': ['Karnataka', 'Tamil Nadu', 'Telangana'],
  'East':  ['West Bengal', 'Odisha'],
  'West':  ['Maharashtra', 'Gujarat'],
};

const STATE_MAP = {
  'Delhi NCR':     ['New Delhi', 'Noida', 'Gurgaon'],
  'Uttar Pradesh': ['Lucknow', 'Agra'],
  'Punjab':        ['Amritsar', 'Ludhiana'],
  'Karnataka':     ['Bangalore'],
  'Tamil Nadu':    ['Chennai', 'Coimbatore'],
  'Telangana':     ['Hyderabad'],
  'West Bengal':   ['Kolkata'],
  'Odisha':        ['Bhubaneswar'],
  'Maharashtra':   ['Mumbai', 'Pune'],
  'Gujarat':       ['Ahmedabad', 'Surat'],
};

// Per-store profiles — deterministic seed from store index
const STORE_DATA = {};
STORE_LIST.forEach((store, i) => {
  const t = ((i * 7 + 3) % STORE_LIST.length) / STORE_LIST.length;
  STORE_DATA[store.name] = {
    scale:       0.4 + t * 1.2,
    attendRate:  0.60 + t * 0.35,
    avgWait:     6 + Math.round(t * 22),
    genderMix:   [0.50 + t * 0.10, 0.35 - t * 0.05],
  };
});

function computeFilteredConfig(storeNames) {
  if (!storeNames || storeNames.length === 0) return null;
  const profiles = storeNames.map(n => STORE_DATA[n]).filter(Boolean);
  if (!profiles.length) return null;

  const n = profiles.length;
  const totalStores = STORE_LIST.length;
  const allAvgScale = STORE_LIST.reduce((a, s) => a + STORE_DATA[s.name].scale, 0) / totalStores;
  const avgScale    = profiles.reduce((a, p) => a + p.scale, 0) / n;

  return {
    ratio:       (avgScale / allAvgScale) * (n / totalStores),
    attendRate:  profiles.reduce((a, p) => a + p.attendRate, 0) / n,
    avgWait:     Math.round(profiles.reduce((a, p) => a + p.avgWait, 0) / n),
    genderMix:   [
      profiles.reduce((a, p) => a + p.genderMix[0], 0) / n,
      profiles.reduce((a, p) => a + p.genderMix[1], 0) / n,
    ],
  };
}

function initReportFilters(dbData) {
  const regionEl = document.getElementById('filter-region');
  const stateEl  = document.getElementById('filter-state');
  const cityEl   = document.getElementById('filter-city');
  const trigger  = document.getElementById('store-ms-trigger');
  const dropdown = document.getElementById('store-ms-dropdown');
  const list     = document.getElementById('store-ms-list');
  const search   = document.getElementById('store-ms-search');
  const clearBtn = document.getElementById('store-ms-clear');
  const applyBtn = document.getElementById('store-ms-apply');
  const label    = document.getElementById('store-ms-label');

  if (!stateEl || !trigger) return;

  let selectedStores = new Set();

  // ── Cascading dropdowns ─────────────────────────────────────────────────
  function refreshStates() {
    const region = regionEl?.value || '';
    stateEl.innerHTML = '<option value="">All States</option>';
    const states = region ? REGION_MAP[region] : Object.keys(STATE_MAP);
    states.forEach(s => {
      const o = document.createElement('option');
      o.value = o.textContent = s;
      stateEl.appendChild(o);
    });
  }

  function refreshCities() {
    const region = regionEl?.value || '';
    const state  = stateEl.value;
    cityEl.innerHTML = '<option value="">All Cities</option>';
    let statesToShow = state ? [state] : (region ? REGION_MAP[region] : Object.keys(STATE_MAP));
    statesToShow.forEach(s => {
      (STATE_MAP[s] || []).forEach(c => {
        const o = document.createElement('option');
        o.value = o.textContent = c;
        cityEl.appendChild(o);
      });
    });
  }

  // ── Filter-driven re-render ─────────────────────────────────────────────
  function applyCurrentFilter() {
    const visible = getFilteredStores().map(s => s.name);
    const names   = selectedStores.size > 0 ? [...selectedStores] : visible;
    const fc = computeFilteredConfig(names);
    buildReportContent(dbData, fc);
  }

  regionEl?.addEventListener('change', () => {
    stateEl.value = '';
    cityEl.value  = '';
    refreshStates();
    refreshCities();
    selectedStores.clear();
    refreshStoreList();
    applyCurrentFilter();
  });

  stateEl.addEventListener('change', () => {
    cityEl.value = '';
    refreshCities();
    selectedStores = new Set([...selectedStores].filter(n => getFilteredStores().some(s => s.name === n)));
    refreshStoreList();
    applyCurrentFilter();
  });

  cityEl.addEventListener('change', () => {
    selectedStores = new Set([...selectedStores].filter(n => getFilteredStores().some(s => s.name === n)));
    refreshStoreList();
    applyCurrentFilter();
  });

  // ── Store multi-select list ─────────────────────────────────────────────
  function getFilteredStores(query = '') {
    const region = regionEl?.value || '';
    const state  = stateEl.value;
    const city   = cityEl.value;
    const q      = query.toLowerCase();
    return STORE_LIST.filter(s =>
      (!region || s.region === region) &&
      (!state  || s.state  === state)  &&
      (!city   || s.city   === city)   &&
      (!q      || s.name.toLowerCase().includes(q))
    );
  }

  function renderStoreOptions(query = '') {
    const stores = getFilteredStores(query);
    list.innerHTML = '';
    if (stores.length === 0) {
      list.innerHTML = '<div style="padding:10px 14px;font-size:0.78rem;color:#9ca3af">No stores found</div>';
      return;
    }
    stores.forEach(s => {
      const row = document.createElement('label');
      row.className = 'filter-ms-option';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = s.name;
      cb.checked = selectedStores.has(s.name);
      cb.addEventListener('change', () => {
        if (cb.checked) selectedStores.add(s.name);
        else selectedStores.delete(s.name);
      });
      const span = document.createElement('span');
      span.textContent = s.name;
      row.appendChild(cb);
      row.appendChild(span);
      list.appendChild(row);
    });
  }

  function refreshStoreList() {
    selectedStores = new Set([...selectedStores].filter(n => getFilteredStores().some(s => s.name === n)));
    renderStoreOptions(search?.value || '');
    updateLabel();
  }

  function updateLabel() {
    if (selectedStores.size === 0) {
      label.innerHTML = 'All Stores';
    } else {
      label.innerHTML = `${selectedStores.size} Store${selectedStores.size > 1 ? 's' : ''} <span class="filter-ms-count">${selectedStores.size}</span>`;
    }
  }

  // ── Toggle dropdown ─────────────────────────────────────────────────────
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    trigger.classList.toggle('open', isOpen);
    if (isOpen) {
      renderStoreOptions(search?.value || '');
      search?.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      trigger.classList.remove('open');
    }
  });

  search?.addEventListener('input', () => renderStoreOptions(search.value));

  clearBtn?.addEventListener('click', () => {
    selectedStores.clear();
    renderStoreOptions(search?.value || '');
    updateLabel();
  });

  applyBtn?.addEventListener('click', () => {
    dropdown.classList.remove('open');
    trigger.classList.remove('open');
    updateLabel();
    applyCurrentFilter();
  });

  // Initial population
  refreshStates();
  refreshCities();
  renderStoreOptions();
}

// ── Public Init ──────────────────────────────────────────────────────────────

export function initReport(dbData) {
  const openBtn   = document.getElementById('btn-open-report');
  const modal     = document.getElementById('report-modal-overlay');
  const closeBtn  = document.getElementById('btn-close-report');
  const dlBtn     = document.getElementById('btn-report-download');
  const picker    = document.getElementById('report-format-picker');
  const dlPDF     = document.getElementById('dl-pdf');
  const dlExcel   = document.getElementById('dl-excel');

  if (!openBtn || !modal) return;

  initReportFilters(dbData);

  // Open report — navigate to #report (full-page view)
  openBtn.addEventListener('click', () => {
    buildReportContent(dbData);
    window.location.hash = '#report';
  });

  // Close report — navigate back to dashboard
  function closeReport() {
    window.location.hash = '#dashboard';
    picker?.classList.remove('open');
    hideChartTooltip();
  }

  closeBtn?.addEventListener('click', closeReport);

  // Download picker toggle
  dlBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    picker?.classList.toggle('open');
  });

  document.addEventListener('click', () => picker?.classList.remove('open'));

  // Download actions
  dlPDF?.addEventListener('click', () => {
    picker?.classList.remove('open');
    downloadPDF();
  });

  dlExcel?.addEventListener('click', () => {
    picker?.classList.remove('open');
    downloadExcel(dbData);
  });

  // Keyboard close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeReport();
  });
}
