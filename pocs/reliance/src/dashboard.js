import { TimeSeriesGraph, MultiSeriesGraph } from './graph.js';

const IST_TIME_OPTIONS = {
  timeZone: 'Asia/Kolkata',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

function formatISTTime() {
  return new Date().toLocaleTimeString('en-IN', IST_TIME_OPTIONS);
}

const FOOTFALL_COLORS = {
  male: '#2563eb',
  female: '#ec4899',
  child: '#eab308',
};

const FIRST_ZONE_COLORS = {
  apple:   '#10b981',
  android: '#f97316',
};

const GREETINGS_COLORS = {
  attended:   '#10b981',
  unattended: '#ef4444',
};

export function initDashboard(dbData) {
  const clockEl = document.getElementById('ist-clock');
  if (clockEl) {
    clockEl.textContent = formatISTTime();
    setInterval(() => {
      clockEl.textContent = formatISTTime();
    }, 1000);
  }

  const hasFootfall = !!(dbData && dbData.footfall && dbData.footfall.rows && dbData.footfall.rows.length);
  const hasTrials = !!(dbData && dbData.trials && dbData.trials.rows && dbData.trials.rows.length);
  const hasFirstZone = !!(dbData && dbData.firstZone && dbData.firstZone.rows && dbData.firstZone.rows.length);
  const hasGreetings = !!(dbData && dbData.greetings && dbData.greetings.rows && dbData.greetings.rows.length);

  const cards = document.querySelectorAll('.kpi-card[data-kpi]');

  cards.forEach((section) => {
    const kpiId = section.getAttribute('data-kpi');
    if (!kpiId) return;

    const video = section.querySelector('.kpi-video');
    const canvas = section.querySelector('.kpi-graph');
    const metricValue = section.querySelector('.kpi-metric-value');
    if (!video || !canvas || !metricValue) return;

    if (kpiId === 'footfall') {
      const footfall = hasFootfall ? dbData.footfall : null;
      const maleSeries = footfall ? footfall.maleSeries : [];
      const femaleSeries = footfall ? footfall.femaleSeries : [];
      const childSeries = footfall ? footfall.childSeries : [];
      const rows = footfall ? footfall.rows : [];

      const graph = new MultiSeriesGraph(canvas, {
        series: [
          { values: maleSeries, color: FOOTFALL_COLORS.male, label: 'Male' },
          { values: femaleSeries, color: FOOTFALL_COLORS.female, label: 'Female' },
          { values: childSeries, color: FOOTFALL_COLORS.child, label: 'Child' },
        ],
        yMax: 50,
        playheadColor: '#6b7280',
        showLiveCount: true,
      });

      const updateForTime = () => {
        if (!rows.length) {
          metricValue.textContent = hasFootfall ? '0' : 'ERROR';
          graph.render();
          return;
        }
        const currentSecond = Math.floor(video.currentTime || 0);
        const idx = Math.min(currentSecond, rows.length - 1);
        const row = rows[idx];
        const inCount = row.in_count || [0, 0, 0];
        const sum = inCount[0] + inCount[1] + inCount[2];
        metricValue.textContent = String(sum);

        graph.setCurrentIndex(idx);
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

    if (kpiId === 'apple-zone') {
      const trials = hasTrials ? dbData.trials : null;
      const rows = trials ? trials.rows : [];


      const employeeBadge = section.querySelector('.kpi-employee-badge');
      const interactionTimeEl = section.querySelector('.kpi-interaction-time-value');

      // Build cumulative unique series to match the metric shown
      const cumulativeUniqueSeries = rows.map(r => r.cumulativeUnique ?? 0);
      const maxUnique = cumulativeUniqueSeries.length ? Math.max(...cumulativeUniqueSeries) : 10;

      const graph = new TimeSeriesGraph(canvas, {
        yMax: Math.ceil(maxUnique * 1.2) || 10,
        lineColor: '#8b5cf6',
        playheadColor: '#6b7280',
        showLiveCount: true,
      });

      graph.setValues(cumulativeUniqueSeries);

      // Precompute cumulative interaction seconds (employee present AND customer_count > 0)
      const cumulativeInteraction = rows.map(((acc) => (row) => {
        acc += (row.employee === true && (row.customer ?? 0) > 0) ? 1 : 0;
        return acc;
      })(0));

      function formatInteractionTime(seconds) {
        const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
        const ss = (seconds % 60).toString().padStart(2, '0');
        return `${mm}:${ss}`;
      }

      const updateForTime = () => {
        if (!rows.length) {
          metricValue.textContent = hasTrials ? '0' : 'ERROR';
          if (employeeBadge) {
            employeeBadge.textContent = 'Employee: --';
            employeeBadge.classList.remove('employee-present', 'employee-absent');
          }
          if (interactionTimeEl) interactionTimeEl.textContent = '00:00';
          graph.render();
          return;
        }
        const currentSecond = Math.floor(video.currentTime || 0);
        const idx = Math.min(currentSecond, rows.length - 1);
        const row = rows[idx];

        metricValue.textContent = String(row.cumulativeUnique ?? 0);

        if (employeeBadge) {
          const present = row.employee === true;
          employeeBadge.textContent = present ? 'Employee: Present' : 'Employee: Absent';
          employeeBadge.classList.toggle('employee-present', present);
          employeeBadge.classList.toggle('employee-absent', !present);
        }

        if (interactionTimeEl) {
          interactionTimeEl.textContent = formatInteractionTime(cumulativeInteraction[idx] ?? 0);
        }

        graph.setCurrentIndex(idx);
        graph.setValueAt(idx, row.cumulativeUnique ?? 0);
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

    if (kpiId === 'first-zone') {
      const fz = hasFirstZone ? dbData.firstZone : null;
      const rows = fz ? fz.rows : [];

      const graph = new MultiSeriesGraph(canvas, {
        series: [
          { values: fz ? fz.appleSeries : [],   color: FIRST_ZONE_COLORS.apple,   label: 'Apple' },
          { values: fz ? fz.androidSeries : [], color: FIRST_ZONE_COLORS.android, label: 'Android' },
        ],
        yMax: 20,
        playheadColor: '#6b7280',
        showLiveCount: true,
      });

      const appleCountEl = section.querySelector('.first-zone-apple-count');
      const androidCountEl = section.querySelector('.first-zone-android-count');

      const updateForTime = () => {
        if (!rows.length) {
          const fallback = hasFirstZone ? '0' : 'ERROR';
          metricValue.textContent = fallback;
          if (appleCountEl) appleCountEl.textContent = fallback;
          if (androidCountEl) androidCountEl.textContent = fallback;
          graph.render();
          return;
        }
        const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
        const row = rows[idx];
        if (appleCountEl) appleCountEl.textContent = String(row.apple_count ?? 0);
        if (androidCountEl) androidCountEl.textContent = String(row.android_count ?? 0);
        graph.setCurrentIndex(idx);
        graph.render();
      };

      const resizeObserver = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width  = rect.width  * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        graph.render();
      });
      resizeObserver.observe(canvas);
      video.addEventListener('loadedmetadata', updateForTime);
      video.addEventListener('timeupdate',     updateForTime);
      return;
    }

    if (kpiId === 'greetings') {
      const gr = hasGreetings ? dbData.greetings : null;
      const rows = gr ? gr.rows : [];
      const avgWaitSeries = gr ? gr.avgWaitSeries : [];
      const avgWaitSeriesRounded = avgWaitSeries.map(v => Math.round(v));
      const waitTimeValueEl = section.querySelector('.kpi-wait-time-value');

      const maxAvgWait = avgWaitSeries.length ? Math.max(...avgWaitSeries) : 10;

      const graph = new TimeSeriesGraph(canvas, {
        yMax: Math.ceil(maxAvgWait * 1.2) || 10,
        lineColor: GREETINGS_COLORS.attended,
        playheadColor: '#6b7280',
        showLiveCount: true,
      });
      graph.setValues(avgWaitSeriesRounded);

      let waitTimeRaf = null;
      let lastWaitTimeTarget = -1;
      let currentDisplaySeconds = 0;

      function formatWaitTime(seconds) {
        const total = Math.round(seconds);
        const mm = Math.floor(total / 60).toString().padStart(2, '0');
        const ss = (total % 60).toString().padStart(2, '0');
        return `${mm}:${ss}`;
      }

      function animateWaitTime(fromSeconds, targetSeconds, el) {
        if (waitTimeRaf) {
          cancelAnimationFrame(waitTimeRaf);
          waitTimeRaf = null;
        }
        const diff = targetSeconds - fromSeconds;
        const startTime = performance.now();
        function step(now) {
          const elapsed = (now - startTime) / 1000;
          const current = diff >= 0
            ? Math.min(fromSeconds + elapsed, targetSeconds)
            : Math.max(fromSeconds - elapsed, targetSeconds);
          currentDisplaySeconds = current;
          el.textContent = formatWaitTime(current);
          const done = diff >= 0 ? current >= targetSeconds : current <= targetSeconds;
          if (!done) {
            waitTimeRaf = requestAnimationFrame(step);
          } else {
            currentDisplaySeconds = targetSeconds;
            waitTimeRaf = null;
          }
        }
        waitTimeRaf = requestAnimationFrame(step);
      }

      const updateForTime = () => {
        if (!rows.length) {
          metricValue.textContent = hasGreetings ? '0' : 'ERROR';
          if (waitTimeValueEl) waitTimeValueEl.textContent = '00:00';
          graph.render();
          return;
        }
        const idx = Math.min(Math.floor(video.currentTime || 0), rows.length - 1);
        const row = rows[idx];
        metricValue.textContent = String(row.attended || 0);
        if (waitTimeValueEl) {
          const avgWaitTime = row.avg_wait_time || 0;
          if (avgWaitTime !== lastWaitTimeTarget) {
            lastWaitTimeTarget = avgWaitTime;
            animateWaitTime(currentDisplaySeconds, avgWaitTime, waitTimeValueEl);
          }
        }
        graph.setCurrentIndex(idx);
        graph.render();
      };

      const resizeObserver = new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width  = rect.width  * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        graph.render();
      });
      resizeObserver.observe(canvas);
      video.addEventListener('loadedmetadata', updateForTime);
      video.addEventListener('timeupdate',     updateForTime);
    }
  });
}
