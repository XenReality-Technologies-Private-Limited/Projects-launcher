const STAGE_COLORS = ['#6B7280', '#2563EB', '#8B5CF6', '#10B981'];

function conversionColor(pct) {
  if (pct >= 50) return '#10B981';
  if (pct >= 25) return '#F59E0B';
  return '#EF4444';
}

export function renderFunnel(container, { totals, rates }) {
  const stages = [
    {
      key:      'passerby',
      label:    'Passerby',
      sublabel: 'Walking past store',
      count:    totals.passerby,
      color:    STAGE_COLORS[0],
      convRate: null,
      convLabel: null,
    },
    {
      key:      'storeEntry',
      label:    'Store Entry',
      sublabel: 'Entered the store',
      count:    totals.storeEntry,
      color:    STAGE_COLORS[1],
      convRate: rates.captureRate,
      convLabel: 'of passersby entered',
    },
    {
      key:      'trialRoom',
      label:    'Trial Zone',
      sublabel: 'Used fitting room',
      count:    totals.trialRoom,
      color:    STAGE_COLORS[2],
      convRate: rates.trialRate,
      convLabel: 'of visitors tried',
    },
    {
      key:      'billing',
      label:    'Billing',
      sublabel: 'Completed purchase',
      count:    totals.billing,
      color:    STAGE_COLORS[3],
      convRate: rates.purchaseRate,
      convLabel: 'of trial → purchased',
    },
  ];

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  const html = stages
    .map((stage, i) => {
      const widthPct = stage.count === 0 ? 0 : Math.round((stage.count / maxCount) * 100);
      const convHtml =
        stage.convRate !== null
          ? (() => {
              const pct = Math.round(stage.convRate * 100);
              const color = conversionColor(pct);
              return `
              <div class="funnel-connector">
                <div class="funnel-conn-line"></div>
                <div class="funnel-conn-badge" style="color:${color}">
                  <span class="conn-arrow">↓</span>
                  <span class="conn-pct">${pct}%</span>
                  <span class="conn-label">${stage.convLabel}</span>
                </div>
              </div>`;
            })()
          : '';

      return `
      ${convHtml}
      <div class="funnel-stage" style="--stage-delay:${i * 120}ms">
        <div class="funnel-stage-header">
          <div class="funnel-stage-dot" style="background:${stage.color}"></div>
          <span class="funnel-stage-label">${stage.label}</span>
          <span class="funnel-stage-sub">${stage.sublabel}</span>
          <span class="funnel-stage-count" style="color:${stage.color}">${stage.count.toLocaleString()}</span>
        </div>
        <div class="funnel-bar-track">
          <div
            class="funnel-bar"
            data-target="${widthPct}"
            style="background:${stage.color};width:0%"
          ></div>
        </div>
      </div>`;
    })
    .join('');

  container.innerHTML = `<div class="funnel-wrap">${html}</div>`;

  // Trigger bar animations after a short delay (allows CSS transitions to fire)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll('.funnel-bar').forEach((bar, i) => {
        setTimeout(() => {
          bar.style.width = `${bar.dataset.target}%`;
        }, i * 120 + 80);
      });
    });
  });
}

// Live update — called on every timeupdate. Updates text and bar widths without
// re-rendering the whole funnel. maxPasserby is fixed (from final row) so bars
// don't rescale as counts grow during playback.
export function updateFunnel(container, totals, rates, maxPasserby) {
  const max = Math.max(maxPasserby, 1);
  const counts = [totals.passerby, totals.storeEntry, totals.trialRoom, totals.billing];
  const convRates = [null, rates.captureRate, rates.trialRate, rates.purchaseRate];

  const stages = container.querySelectorAll('.funnel-stage');
  const badges = container.querySelectorAll('.funnel-conn-badge');

  stages.forEach((stageEl, i) => {
    const count = counts[i] || 0;
    const widthPct = count === 0 ? 0 : Math.round((count / max) * 100);

    const countEl = stageEl.querySelector('.funnel-stage-count');
    if (countEl) countEl.textContent = count.toLocaleString();

    const barEl = stageEl.querySelector('.funnel-bar');
    if (barEl) barEl.style.width = `${widthPct}%`;
  });

  badges.forEach((badge, i) => {
    const rate = convRates[i + 1];
    if (rate == null) return;
    const pct = Math.round(Math.min(1, rate) * 100);
    const color = conversionColor(pct);
    badge.style.color = color;
    const pctEl = badge.querySelector('.conn-pct');
    if (pctEl) pctEl.textContent = `${pct}%`;
  });
}
