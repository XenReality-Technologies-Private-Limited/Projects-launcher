function pct(num, den) {
  if (!den) return '0%';
  return `${Math.round(Math.min(1, num / den) * 100)}%`;
}

const STAGES = [
  { key: 'pb', label: 'Passerby',      sublabel: 'Outside Store',  color: '#2E3192' },
  { key: 'ft', label: 'Store Visitors', sublabel: 'Footfall Entry', color: '#00AEEF' },
];

export function renderFunnel(container) {
  container.innerHTML = `
    <div class="funnel-wrap">
      ${STAGES.map((s, i) => `
        <div class="funnel-stage" data-key="${s.key}">
          <div class="funnel-stage-header">
            <span class="funnel-dot" style="background:${s.color}"></span>
            <span class="funnel-stage-label">${s.label}</span>
            <span class="funnel-stage-sublabel">${s.sublabel}</span>
            <span class="funnel-stage-count" id="funnel-count-${s.key}">0</span>
          </div>
          <div class="funnel-bar-track">
            <div class="funnel-bar" id="funnel-bar-${s.key}" style="background:${s.color}; width:0%"></div>
          </div>
          ${i < STAGES.length - 1 ? `
            <div class="funnel-connector">
              <div class="funnel-arrow">&#8595;</div>
              <span class="funnel-pct-badge" id="funnel-pct-${s.key}">–</span>
              <span class="funnel-conv-label">conversion</span>
            </div>` : ''}
        </div>
      `).join('')}
    </div>`;
}

export function updateFunnel(container, frame) {
  const { pbIn, ftIn } = frame;
  const max = Math.max(pbIn, 1);

  const stageData = {
    pb: { count: pbIn, pctDen: pbIn, pctNum: ftIn },
    ft: { count: ftIn, pctDen: null, pctNum: null },
  };

  for (const s of STAGES) {
    const d = stageData[s.key];
    const countEl = container.querySelector(`#funnel-count-${s.key}`);
    const barEl   = container.querySelector(`#funnel-bar-${s.key}`);
    const pctEl   = container.querySelector(`#funnel-pct-${s.key}`);

    if (countEl) countEl.textContent = d.count.toLocaleString();
    if (barEl)   barEl.style.width = d.count === 0 ? '0%' : `${Math.round((d.count / max) * 100)}%`;
    if (pctEl && d.pctDen !== null) {
      pctEl.textContent = pct(d.pctNum, d.pctDen);
    }
  }
}
