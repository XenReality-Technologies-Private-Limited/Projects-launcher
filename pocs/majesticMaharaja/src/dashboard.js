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

    let video;
    if (kpiId === 'footfall') video = document.getElementById('vid-footfall');
    if (kpiId === 'zone') video = document.getElementById('vid-zone');

    if (kpiId === 'footfall') {
      const footfall = hasFootfall ? dbData.footfall : null;
      const rows = footfall ? footfall.rows : [];

      const inCountEl = section.querySelector('.footfall-in-count');
      const outCountEl = section.querySelector('.footfall-out-count');
      const dwellTimeEl = section.querySelector('.footfall-dwell-time');
      
      const inMaleEl = section.querySelector('.footfall-in-male');
      const inFemaleEl = section.querySelector('.footfall-in-female');
      const inChildEl = section.querySelector('.footfall-in-child');
      
      const outMaleEl = section.querySelector('.footfall-out-male');
      const outFemaleEl = section.querySelector('.footfall-out-female');
      const outChildEl = section.querySelector('.footfall-out-child');

      function formatTime(seconds) {
        const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
        const ss = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${mm}:${ss}`;
      }

      const dwellTimesAtSecond = [];
      let entryTimes = [];
      let currentTotalIn = 0;
      let currentTotalOut = 0;
      let totalDwellTime = 0;
      let totalCompleted = 0;

      for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        while (currentTotalIn < row.total_in) {
          entryTimes.push(i);
          currentTotalIn++;
        }
        while (currentTotalOut < row.total_out) {
          if (entryTimes.length > 0) {
            let enterTime = entryTimes.shift(); // FIFO
            let dwell = i - enterTime;
            totalDwellTime += dwell;
            totalCompleted++;
          }
          currentTotalOut++;
        }
        if (totalCompleted > 0) {
          dwellTimesAtSecond[i] = formatTime(totalDwellTime / totalCompleted);
        } else {
          dwellTimesAtSecond[i] = "00:00";
        }
      }

      const updateForTime = () => {
        if (!rows.length) {
          if (inCountEl) inCountEl.textContent = '0';
          if (outCountEl) outCountEl.textContent = '0';
          if (dwellTimeEl) dwellTimeEl.textContent = '00:00';
          return;
        }
        const currentSecond = Math.floor(video.currentTime || 0);
        const idx = Math.min(currentSecond, rows.length - 1);
        const row = rows[idx];
        
        if (inCountEl) inCountEl.textContent = String(row.total_in || 0);
        if (outCountEl) outCountEl.textContent = String(row.total_out || 0);
        if (dwellTimeEl) dwellTimeEl.textContent = dwellTimesAtSecond[idx] || "00:00";
        
        if (row.in_count) {
          if (inMaleEl) inMaleEl.textContent = String(row.in_count[0] || 0);
          if (inFemaleEl) inFemaleEl.textContent = String(row.in_count[1] || 0);
          if (inChildEl) inChildEl.textContent = String(row.in_count[2] || 0);
        }
        
        if (row.out_count) {
          if (outMaleEl) outMaleEl.textContent = String(row.out_count[0] || 0);
          if (outFemaleEl) outFemaleEl.textContent = String(row.out_count[1] || 0);
          if (outChildEl) outChildEl.textContent = String(row.out_count[2] || 0);
        }
      };

      video.addEventListener('loadedmetadata', updateForTime);
      video.addEventListener('timeupdate', updateForTime);
      return;
    }

    if (kpiId === 'zone') {
      const zone = hasZone ? dbData.zone : null;
      const rows = zone ? zone.rows : [];
      const interactionSeries = zone ? zone.interactionSeries : [];

      const employeeBadge = section.querySelector('.kpi-employee-badge');
      const customerBadge = section.querySelector('.kpi-customer-badge');
      const interactionTimeEl = section.querySelector('.kpi-interaction-time-value');

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
      };

      video.addEventListener('loadedmetadata', updateForTime);
      video.addEventListener('timeupdate', updateForTime);
      return;
    }
  });

  // ── Global Video Controls ──
  const vids = [document.getElementById('vid-footfall'), document.getElementById('vid-zone')].filter(Boolean);
  const btnPlay = document.getElementById('btn-play');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const btnSpeed = document.getElementById('btn-speed');
  const seekBar = document.getElementById('seek-bar');
  const timeDisplay = document.getElementById('time-display');
  const masterVid = vids[0];

  if (masterVid && btnPlay) {
    let speed = 1;
    btnPlay.onclick = () => vids.forEach(v => v.play().catch(e=>console.warn(e)));
    btnPause.onclick = () => vids.forEach(v => v.pause());
    btnReset.onclick = () => vids.forEach(v => { v.currentTime = 0; v.pause(); });
    btnSpeed.onclick = () => {
      speed = speed === 1 ? 2 : speed === 2 ? 4 : speed === 4 ? 0.5 : 1;
      btnSpeed.textContent = speed + 'x Speed';
      vids.forEach(v => {
        v.playbackRate = speed;
        v.preservesPitch = false;
      });
    };

    masterVid.addEventListener('waiting', () => vids.forEach(v => v.pause()));
    masterVid.addEventListener('playing', () => {
      vids.forEach(v => {
        v.playbackRate = speed;
        v.preservesPitch = false;
        if (v !== masterVid) v.play().catch(e => console.warn(e));
      });
    });
    masterVid.addEventListener('loadedmetadata', () => {
      seekBar.max = masterVid.duration;
    });
    masterVid.addEventListener('timeupdate', () => {
      if (!masterVid.paused) seekBar.value = masterVid.currentTime;
      const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
      if (timeDisplay) timeDisplay.textContent = `${fmt(masterVid.currentTime)} / ${fmt(masterVid.duration || 0)}`;
    });
    seekBar.addEventListener('input', (e) => {
      vids.forEach(v => v.currentTime = parseFloat(e.target.value));
    });
  }
}
