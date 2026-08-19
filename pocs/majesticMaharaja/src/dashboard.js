import { TimeSeriesGraph, MultiSeriesGraph } from './graph.js';

export function initDashboard(dbData) {
  const hdrDate = document.getElementById('hdr-date');
  const hdrTime = document.getElementById('hdr-time');
  function tickClock() {
    const now = new Date();
    if (hdrDate) hdrDate.textContent = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (hdrTime) hdrTime.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 1000);

  const hasFootfall = !!(dbData && dbData.footfall && dbData.footfall.rows && dbData.footfall.rows.length);
  const hasZone = !!(dbData && dbData.zone && dbData.zone.rows && dbData.zone.rows.length);

  const cards = document.querySelectorAll('.kpi-card[data-kpi]');

  cards.forEach((section) => {
    const kpiId = section.getAttribute('data-kpi');
    if (!kpiId) return;

    const video = section.querySelector('.kpi-video');
    const canvasIn = section.querySelector('.kpi-graph-in');
    const canvasOut = section.querySelector('.kpi-graph-out');
    // We only check video existence here; canvas checks are inside specific blocks because 'zone' only has one canvas

    if (kpiId === 'footfall') {
      const footfall = hasFootfall ? dbData.footfall : null;
      const inS = footfall ? footfall.inSeries : { male: [], female: [], child: [] };
      const outS = footfall ? footfall.outSeries : { male: [], female: [], child: [] };
      const rows = footfall ? footfall.rows : [];

      if (!canvasIn || !canvasOut) return;

      const graphIn = new MultiSeriesGraph(canvasIn, {
        series: [
          { values: inS.male, color: '#2563eb', label: 'Male' },
          { values: inS.female, color: '#ec4899', label: 'Female' },
          { values: inS.child, color: '#eab308', label: 'Child' },
        ],
        yMax: 20,
        playheadColor: '#6b7280',
        showLiveCount: true,
      });

      const graphOut = new MultiSeriesGraph(canvasOut, {
        series: [
          { values: outS.male, color: '#2563eb', label: 'Male' },
          { values: outS.female, color: '#ec4899', label: 'Female' },
          { values: outS.child, color: '#eab308', label: 'Child' },
        ],
        yMax: 20,
        playheadColor: '#6b7280',
        showLiveCount: true,
      });

      const inCountEl = section.querySelector('.footfall-in-count');
      const outCountEl = section.querySelector('.footfall-out-count');

      const updateForTime = () => {
        if (!rows.length) {
          if (inCountEl) inCountEl.textContent = '0';
          if (outCountEl) outCountEl.textContent = '0';
          graphIn.render();
          graphOut.render();
          return;
        }
        const currentSecond = Math.floor(video.currentTime || 0);
        const idx = Math.min(currentSecond, rows.length - 1);
        const row = rows[idx];
        
        if (inCountEl) inCountEl.textContent = String(row.total_in || 0);
        if (outCountEl) outCountEl.textContent = String(row.total_out || 0);

        graphIn.setCurrentIndex(idx);
        graphIn.render();

        graphOut.setCurrentIndex(idx);
        graphOut.render();
      };

      const resizeObserver = new ResizeObserver(() => {
        const rectIn = canvasIn.getBoundingClientRect();
        canvasIn.width = rectIn.width * window.devicePixelRatio;
        canvasIn.height = rectIn.height * window.devicePixelRatio;
        graphIn.render();

        const rectOut = canvasOut.getBoundingClientRect();
        canvasOut.width = rectOut.width * window.devicePixelRatio;
        canvasOut.height = rectOut.height * window.devicePixelRatio;
        graphOut.render();
      });
      resizeObserver.observe(canvasIn);
      resizeObserver.observe(canvasOut);

      video.addEventListener('loadedmetadata', updateForTime);
      video.addEventListener('timeupdate', updateForTime);
      return;
    }

    if (kpiId === 'zone') {
      const zone = hasZone ? dbData.zone : null;
      const rows = zone ? zone.rows : [];
      const interactionSeries = zone ? zone.interactionSeries : [];

      const canvas = section.querySelector('.kpi-graph');
      if (!canvas) return;

      const employeeBadge = section.querySelector('.kpi-employee-badge');
      const customerBadge = section.querySelector('.kpi-customer-badge');
      const interactionTimeEl = section.querySelector('.kpi-interaction-time-value');

      const maxInteraction = interactionSeries.length ? Math.max(...interactionSeries) : 10;

      const graph = new TimeSeriesGraph(canvas, {
        yMax: Math.ceil(maxInteraction * 1.2) || 10,
        lineColor: '#8b5cf6',
        playheadColor: '#6b7280',
        showLiveCount: true,
      });

      graph.setValues(interactionSeries);

      function formatInteractionTime(seconds) {
        const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
        const ss = (seconds % 60).toString().padStart(2, '0');
        return `${mm}:${ss}`;
      }

      const updateForTime = () => {
        if (!rows.length) {
          if (employeeBadge) {
            employeeBadge.textContent = 'Employee: --';
            employeeBadge.style.color = '#374151';
            employeeBadge.style.background = '#e5e7eb';
          }
          if (customerBadge) {
            customerBadge.textContent = 'Customer: --';
            customerBadge.style.color = '#374151';
            customerBadge.style.background = '#e5e7eb';
          }
          if (interactionTimeEl) interactionTimeEl.textContent = '00:00';
          graph.render();
          return;
        }
        const cTime = video.currentTime || 0;
        let idx = 0;
        let low = 0;
        let high = rows.length - 1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          if (rows[mid].video_time <= cTime) {
            idx = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        const row = rows[idx];

        if (employeeBadge) {
          const present = row.employee > 0;
          employeeBadge.textContent = present ? 'Employee: Present' : 'Employee: Absent';
          employeeBadge.style.color = present ? '#065f46' : '#991b1b';
          employeeBadge.style.background = present ? '#d1fae5' : '#fee2e2';
        }
        
        if (customerBadge) {
          const present = row.customer > 0;
          customerBadge.textContent = present ? 'Customer: Present' : 'Customer: Absent';
          customerBadge.style.color = present ? '#065f46' : '#991b1b';
          customerBadge.style.background = present ? '#d1fae5' : '#fee2e2';
        }

        if (interactionTimeEl) {
          interactionTimeEl.textContent = formatInteractionTime(row.cumulativeInteraction ?? 0);
        }

        graph.setCurrentIndex(idx);
        graph.setValueAt(idx, row.cumulativeInteraction ?? 0);
        graph.render();
      };

      const resizeObserver = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        graph.render();
      });
      resizeObserver.observe(canvas);

      video.addEventListener('loadedmetadata', updateForTime);
      video.addEventListener('timeupdate', updateForTime);
      return;
    }
  });
}
