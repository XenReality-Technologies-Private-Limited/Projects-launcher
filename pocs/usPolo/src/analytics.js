const ZONE_LABELS = {
  entrance: 'Entrance',
  trial:    'Trial Zone',
  upstairs: '1st Floor',
  billing:  'Billing Counter',
};

function normalizeZone(zone) {
  if (!zone) return 'unknown';
  const z = zone.toLowerCase().trim();
  if (z.startsWith('billing')) return 'billing';
  if (z.startsWith('entrance')) return 'entrance';
  if (z.startsWith('trial')) return 'trial';
  if (z.includes('upstair') || z.includes('stair') || z.includes('second') || z.includes('floor')) return 'upstairs';
  return z;
}

// Split a verified total into M/F proportionally from raw DB counts, ensuring M+F = total.
function splitGender(total, rawMan, rawWoman) {
  const rawTotal = (rawMan || 0) + (rawWoman || 0);
  if (rawTotal <= 0 || total <= 0) return { man: 0, woman: 0 };
  const man = Math.round(((rawMan || 0) / rawTotal) * total);
  return { man, woman: total - man };
}

function safeDiv(a, b) {
  if (b <= 0) return 0;
  return Math.min(1, a / b);
}

function formatDwell(seconds) {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── Manually verified session totals (override DB-derived values) ───────────
const VERIFIED_TOTALS = {
  passerby:   117,
  storeEntry:  18,  // 13 in store at start + 5 entered during video
  trialRoom:   12,
  billing:      0,
  upstairs:    10,
};

// People already inside the store when recording began (not counted in DB entry events)
const STORE_ENTRY_BASE    = 13;
const STORE_ENTRY_BASE_M  = 8;
const STORE_ENTRY_BASE_F  = 5;

export function computeAnalytics(rows, zoneEvents) {
  // ── 1. Final totals — use manually verified counts; keep demographics from DB
  const last = rows.length > 0 ? rows[rows.length - 1] : {};
  const storeGender    = splitGender(VERIFIED_TOTALS.storeEntry,  STORE_ENTRY_BASE_M + (last.storeEntryMan || 0),   STORE_ENTRY_BASE_F + (last.storeEntryWoman || 0));
  const trialGender    = splitGender(VERIFIED_TOTALS.trialRoom,   last.trialEntryMan,    last.trialEntryWoman);
  const upstairsGender = splitGender(VERIFIED_TOTALS.upstairs,    last.upstairsEntryMan, last.upstairsEntryWoman);
  const totals = {
    passerby:        VERIFIED_TOTALS.passerby,
    storeEntry:      VERIFIED_TOTALS.storeEntry,
    trialRoom:       VERIFIED_TOTALS.trialRoom,
    billing:         VERIFIED_TOTALS.billing,
    upstairs:        VERIFIED_TOTALS.upstairs,
    storeEntryMan:   storeGender.man,    storeEntryWoman: storeGender.woman,
    trialEntryMan:   trialGender.man,    trialEntryWoman: trialGender.woman,
    billingMan:      0,                  billingWoman:    0,
    upstairsMan:     upstairsGender.man, upstairsWoman:   upstairsGender.woman,
  };

  // ── 2. Conversion rates ──────────────────────────────────────────────────
  const rates = {
    captureRate:   safeDiv(totals.storeEntry, totals.passerby),
    trialRate:     safeDiv(totals.trialRoom,  totals.storeEntry),
    purchaseRate:  safeDiv(totals.billing,    totals.trialRoom),
    overallConv:   safeDiv(totals.billing,    totals.storeEntry),
    floorExplorer: safeDiv(totals.upstairs,   totals.storeEntry),
  };

  // ── 3. Store Health Score (0–100) ────────────────────────────────────────
  const healthScore = Math.min(100, Math.round(
    rates.captureRate   * 0.25 * 100 +
    rates.trialRate     * 0.35 * 100 +
    rates.purchaseRate  * 0.40 * 100
  ));

  // ── 4. Dwell times by zone ────────────────────────────────────────────────
  const dwellAccum = {};

  // Primary: explicit dwell_s on exit events (where available)
  zoneEvents.forEach((evt) => {
    if (!(evt.dwellS > 0)) return;
    const zone = normalizeZone(evt.zoneName);
    if (!dwellAccum[zone]) dwellAccum[zone] = { sum: 0, count: 0, hasExplicit: true };
    dwellAccum[zone].sum   += evt.dwellS;
    dwellAccum[zone].count += 1;
  });

  // Fallback: compute dwell from gid zone-transitions for zones with no explicit data
  const byGidDwell = {};
  zoneEvents.forEach((evt) => {
    if (!byGidDwell[evt.gid]) byGidDwell[evt.gid] = [];
    byGidDwell[evt.gid].push({ t: evt.timestampS, zone: normalizeZone(evt.zoneName) });
  });
  Object.values(byGidDwell).forEach((events) => {
    events.sort((a, b) => a.t - b.t);
    for (let i = 0; i < events.length - 1; i++) {
      const zone = events[i].zone;
      if (dwellAccum[zone] && dwellAccum[zone].hasExplicit) continue;
      const dwell = events[i + 1].t - events[i].t;
      if (dwell <= 0 || dwell > 600) continue;
      if (!dwellAccum[zone]) dwellAccum[zone] = { sum: 0, count: 0 };
      dwellAccum[zone].sum   += dwell;
      dwellAccum[zone].count += 1;
    }
  });

  const dwellByZone = {};
  Object.entries(dwellAccum).forEach(([zone, { sum, count }]) => {
    dwellByZone[zone] = {
      avg:       count > 0 ? sum / count : 0,
      formatted: formatDwell(count > 0 ? sum / count : 0),
      count,
      label:     ZONE_LABELS[zone] || zone,
    };
  });

  // ── 5a. Spotlight journey for GID #8 ─────────────────────────────────────
  const SPOTLIGHT_GID = 8;
  const ZONE_COLORS  = { entrance: '#6B7280', trial: '#8B5CF6', upstairs: '#F59E0B', billing: '#10B981' };
  const ZONE_CAMERA  = { entrance: 'cam1', trial: 'cam5', upstairs: 'cam2', billing: 'cam5' };

  const gidRawEvents = zoneEvents
    .filter((e) => e.gid === SPOTLIGHT_GID)
    .sort((a, b) => a.timestampS - b.timestampS);

  let spotlightJourney = null;
  if (gidRawEvents.length > 0) {
    const startT   = gidRawEvents[0].timestampS;
    const enterEvt = gidRawEvents.filter((e) => e.eventType === 'enter' || e.eventType === 'zone_enter');
    const steps    = [];
    for (let i = 0; i < enterEvt.length; i++) {
      const zone = normalizeZone(enterEvt[i].zoneName);
      if (steps.length > 0 && steps[steps.length - 1].zone === zone) continue;
      const entryT   = Math.round(enterEvt[i].timestampS);
      // Find the nearest exit/zone_exit for this zone after this entry
      const exitEvt  = gidRawEvents.find((e) =>
        e.timestampS > enterEvt[i].timestampS &&
        normalizeZone(e.zoneName) === zone &&
        (e.eventType === 'exit' || e.eventType === 'zone_exit')
      );
      const exitT      = exitEvt ? Math.round(exitEvt.timestampS) : null;
      const exitVideoTs = exitEvt ? exitEvt.timestampS : null;
      const dwellS     = exitEvt ? Math.round(exitEvt.timestampS - enterEvt[i].timestampS) : null;
      const spotlightLabel = zone === 'trial' ? 'Trial Zone' : (ZONE_LABELS[zone] || zone);
      const entryOffset = zone === 'trial' ? -3 : -2;
      // Static image override for the second trial zone visit (12:19 in video)
      const staticEntryImage = (zone === 'trial' && enterEvt[i].timestampS > 700)
        ? 'https://d2uimaqek2eby3.cloudfront.net/US-Polo/image%20(1).png'
        : null;
      steps.push({ zone, label: spotlightLabel, color: ZONE_COLORS[zone] || '#6B7280', camera: ZONE_CAMERA[zone] || 'cam1', entryT, exitT, dwellS, videoTs: enterEvt[i].timestampS, exitVideoTs, entryOffset, staticEntryImage });
    }
    // Drop billing counter steps and noise detections (dwell < 3s)
    const filteredSteps = steps.filter((step, i) =>
      step.zone !== 'billing' &&
      (i === steps.length - 1 || step.dwellS === null || step.dwellS >= 10)
    );
    const totalTime = Math.round(gidRawEvents[gidRawEvents.length - 1].timestampS - startT);
    spotlightJourney = { gid: SPOTLIGHT_GID, steps: filteredSteps, totalTime };
  }

  // ── 5b. Customer journey paths (gid-based from zone_events) ──────────────
  const byGid = {};
  zoneEvents.forEach((evt) => {
    if (evt.eventType !== 'enter' && evt.eventType !== 'zone_enter') return;
    const gid = evt.gid;
    if (!byGid[gid]) byGid[gid] = [];
    byGid[gid].push({ t: evt.timestampS, zone: normalizeZone(evt.zoneName) });
  });

  const pathCounts = {};
  const totalTracked = Object.keys(byGid).length;
  Object.values(byGid).forEach((visits) => {
    visits.sort((a, b) => a.t - b.t);
    // Remove consecutive duplicates
    const zones = visits.reduce((acc, v) => {
      if (acc.length === 0 || acc[acc.length - 1] !== v.zone) acc.push(v.zone);
      return acc;
    }, []);
    if (zones.length === 0) return;
    const path = zones.map((z) => ZONE_LABELS[z] || z).join(' → ');
    pathCounts[path] = (pathCounts[path] || 0) + 1;
  });

  const topJourneys = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([path, count]) => ({
      path,
      count,
      pct: totalTracked > 0 ? count / totalTracked : 0,
    }));

  // ── 6. Time series arrays (scaled to match verified totals) ─────────────
  const dbLast = rows.length > 0 ? rows[rows.length - 1] : {};
  function scaleCol(raw, dbMax, target) {
    if (!dbMax || dbMax <= 0) return 0;
    return Math.round((raw / dbMax) * target);
  }
  const series = {
    passerby:    rows.map((r) => scaleCol(r.passerby, dbLast.passerby || 1, VERIFIED_TOTALS.passerby)),
    storeEntry:  rows.map((r) => scaleCol(r.storeEntry,    dbLast.storeEntry    || 1, VERIFIED_TOTALS.storeEntry)),
    trialEntry:  rows.map((r) => scaleCol(r.trialEntry,    dbLast.trialEntry    || 1, VERIFIED_TOTALS.trialRoom)),
    billingDone: rows.map(() => 0),
    upstairs:    rows.map((r) => scaleCol(r.upstairsEntry, dbLast.upstairsEntry || 1, VERIFIED_TOTALS.upstairs)),
    timestamps:  rows.map((r) => r.timestampSec),
  };

  // ── 7. Peak traffic index (10-second rolling entry rate) ─────────────────
  let peakIdx = 0;
  let maxDelta = 0;
  for (let i = 10; i < rows.length; i++) {
    const delta = rows[i].storeEntry - rows[i - 10].storeEntry;
    if (delta > maxDelta) {
      maxDelta = delta;
      peakIdx = i;
    }
  }

  // ── 8. Session duration ──────────────────────────────────────────────────
  const durationSec = rows.length > 0 ? rows[rows.length - 1].timestampSec : 0;

  return {
    totals,
    rates,
    healthScore,
    dwellByZone,
    topJourneys,
    spotlightJourney,
    series,
    peakIdx,
    totalTracked,
    durationSec,
    hasZoneEvents: zoneEvents.length > 0,
  };
}

// Returns live totals + rates for the current video frame index (scaled to verified totals).
export function computeCurrentTotals(rows, idx) {
  const last = rows[rows.length - 1] || {};
  const row  = rows[Math.min(Math.max(idx, 0), rows.length - 1)];
  function sc(raw, dbMax, target) {
    if (!dbMax || dbMax <= 0) return 0;
    return Math.round((raw / dbMax) * target);
  }
  const storeEntry = STORE_ENTRY_BASE + sc(row.storeEntry, last.storeEntry || 1, VERIFIED_TOTALS.storeEntry - STORE_ENTRY_BASE);
  const trialRoom  = sc(row.trialEntry,    last.trialEntry    || 1, VERIFIED_TOTALS.trialRoom);
  const upstairs   = sc(row.upstairsEntry, last.upstairsEntry || 1, VERIFIED_TOTALS.upstairs);
  const storeG    = splitGender(storeEntry, STORE_ENTRY_BASE_M + (row.storeEntryMan || 0), STORE_ENTRY_BASE_F + (row.storeEntryWoman || 0));
  const trialG    = splitGender(trialRoom,  row.trialEntryMan,    row.trialEntryWoman);
  const upstairsG = splitGender(upstairs,   row.upstairsEntryMan, row.upstairsEntryWoman);
  const totals = {
    passerby:        sc(row.passerby, last.passerby || 1, VERIFIED_TOTALS.passerby),
    storeEntry,
    trialRoom,
    billing:         0,
    upstairs,
    storeEntryMan:   storeG.man,    storeEntryWoman: storeG.woman,
    trialEntryMan:   trialG.man,    trialEntryWoman: trialG.woman,
    billingMan:      0,             billingWoman:    0,
    upstairsMan:     upstairsG.man, upstairsWoman:   upstairsG.woman,
  };
  const rates = {
    captureRate:   safeDiv(totals.storeEntry, totals.passerby),
    trialRate:     safeDiv(totals.trialRoom,  totals.storeEntry),
    purchaseRate:  safeDiv(totals.billing,    totals.trialRoom),
    overallConv:   safeDiv(totals.billing,    totals.storeEntry),
    floorExplorer: safeDiv(totals.upstairs,   totals.storeEntry),
  };
  return { totals, rates };
}
