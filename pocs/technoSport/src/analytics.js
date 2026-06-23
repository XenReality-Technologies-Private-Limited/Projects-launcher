import { parseCount } from './db.js';

function n(val) { return Number(val) || 0; }
function sumArr(arr) { return arr.reduce((a, b) => a + b, 0); }

function safeRate(num, den) {
  if (!den || den === 0) return 0;
  return Math.min(1, num / den);
}

function formatSeconds(secs) {
  const s = Math.round(secs);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

// Map a 0–1 fraction to the correct row in any table,
// so the full video span covers the full data range regardless of row count.
function rowAt(arr, frac) {
  if (!arr.length) return null;
  const idx = Math.min(Math.floor(frac * arr.length), arr.length - 1);
  return arr[idx];
}

function dwellAt(times, arr, frac) {
  if (!times.length) return 0;
  const idx = Math.min(Math.floor(frac * arr.length), arr.length - 1);
  return times[idx] || 0;
}

// frac: 0 = start of video, 1 = end of video
export function computeFrame(frac, data, currentTime = 0) {
  const {
    passerby, footfallGround, footfallFirst, greetings, billing,
    billingCumMax, gfDwellTimes, ffDwellTimes,
  } = data;

  const f = Math.max(0, Math.min(1, frac));

  // ── Passerby ───────────────────────────────────────────────────────────────
  const pbRow    = rowAt(passerby, f);
  const pbIn     = pbRow ? sumArr(parseCount(pbRow.in_count))  : 0;
  const pbMale   = pbRow ? parseCount(pbRow.in_count)[0] : 0;
  const pbFemale = pbRow ? parseCount(pbRow.in_count)[1] : 0;
  const pbChild  = pbRow ? parseCount(pbRow.in_count)[2] : 0;

  // ── Ground Floor Footfall ─────────────────────────────────────────────────
  const gfRow    = rowAt(footfallGround, f);
  const gfIn      = gfRow ? sumArr(parseCount(gfRow.in_count))  : 0;
  const gfOut     = gfRow ? sumArr(parseCount(gfRow.out_count)) : 0;
  const gfMale    = gfRow ? parseCount(gfRow.in_count)[0]  : 0;
  const gfFemale  = gfRow ? parseCount(gfRow.in_count)[1]  : 0;
  const gfChild   = gfRow ? parseCount(gfRow.in_count)[2]  : 0;
  const gfOutMale   = gfRow ? parseCount(gfRow.out_count)[0] : 0;
  const gfOutFemale = gfRow ? parseCount(gfRow.out_count)[1] : 0;
  const gfOutChild  = gfRow ? parseCount(gfRow.out_count)[2] : 0;
  const gfDwell  = dwellAt(gfDwellTimes, footfallGround, f);

  // ── First Floor Footfall ──────────────────────────────────────────────────
  const ffRow    = rowAt(footfallFirst, f);
  const ffIn      = ffRow ? sumArr(parseCount(ffRow.in_count))  : 0;
  const ffOut     = ffRow ? sumArr(parseCount(ffRow.out_count)) : 0;
  const ffMale    = ffRow ? parseCount(ffRow.in_count)[0]  : 0;
  const ffFemale  = ffRow ? parseCount(ffRow.in_count)[1]  : 0;
  const ffChild   = ffRow ? parseCount(ffRow.in_count)[2]  : 0;
  const ffOutMale   = ffRow ? parseCount(ffRow.out_count)[0] : 0;
  const ffOutFemale = ffRow ? parseCount(ffRow.out_count)[1] : 0;
  const ffOutChild  = ffRow ? parseCount(ffRow.out_count)[2] : 0;
  const ffDwell  = dwellAt(ffDwellTimes, footfallFirst, f);

  // ── Greetings ─────────────────────────────────────────────────────────────
  // Attended is always 0 per DB. Unattended = GF In Count, but lagged ~10s.
  // 10s lag expressed as fraction of the ~911s video duration.
  const grRow          = rowAt(greetings, f);
  const greetAttended  = grRow ? n(grRow.attended) : 0;
  const lagFrac        = 10 / 911;
  const greetUnattended = f > lagFrac
    ? sumArr(parseCount((rowAt(footfallGround, f - lagFrac) || {}).in_count || '[0,0,0]'))
    : 0;

  // ── Billing ───────────────────────────────────────────────────────────────
  // At f=0 (before video plays / after reset), show all billing values as 0
  const bRow = f > 0 ? rowAt(billing, f) : null;
  // Hardcoded: 1 at 0:33, 2 at 1:18, 3 at 14:44 (user-verified timestamps)
  const billingCustomers = currentTime >= 884 ? 3
    : currentTime >= 78  ? 2
    : currentTime >= 33  ? 1
    : 0;
  const billingEmpPresent  = bRow ? n(bRow.employee_present) === 1  : false;
  const billingCustPresent = bRow ? n(bRow.customer_present) === 1 : false;
  const empTimeSec         = bRow ? n(bRow.employee_time_seconds)   : 0;
  const interactionSec     = bRow ? n(bRow.interaction_time_seconds): 0;
  const billingDwellSec    = interactionSec; // customer time at counter = interaction duration

  // ── Rates & Health Score ──────────────────────────────────────────────────
  const captureRate      = safeRate(gfIn, pbIn);
  const floorExploreRate = safeRate(ffIn, gfIn);
  const billingRate      = safeRate(billingCustomers, gfIn);

  const healthScore = Math.round(
    (captureRate * 0.35 + floorExploreRate * 0.25 + billingRate * 0.40) * 100
  );

  return {
    pbIn, pbMale, pbFemale, pbChild,
    pbMalePct:   pbIn > 0 ? Math.round(pbMale   / pbIn * 100) : 0,
    pbFemalePct: pbIn > 0 ? Math.round(pbFemale / pbIn * 100) : 0,
    pbChildPct:  pbIn > 0 ? Math.round(pbChild  / pbIn * 100) : 0,
    gfIn, gfOut, gfMale, gfFemale, gfChild,
    gfMalePct:   gfIn > 0 ? Math.round(gfMale   / gfIn * 100) : 0,
    gfFemalePct: gfIn > 0 ? Math.round(gfFemale / gfIn * 100) : 0,
    gfChildPct:  gfIn > 0 ? Math.round(gfChild  / gfIn * 100) : 0,
    gfDwellMin: gfDwell / 60, gfDwellFmt: formatSeconds(gfDwell),
    ffIn, ffOut, ffMale, ffFemale, ffChild,
    ffMalePct:   ffIn > 0 ? Math.round(ffMale   / ffIn * 100) : 0,
    ffFemalePct: ffIn > 0 ? Math.round(ffFemale / ffIn * 100) : 0,
    ffChildPct:  ffIn > 0 ? Math.round(ffChild  / ffIn * 100) : 0,
    ffDwellMin: ffDwell / 60, ffDwellFmt: formatSeconds(ffDwell),
    greetAttended, greetUnattended,
    billingCustomers, billingEmpPresent, billingCustPresent,
    empTimeSec,  empTimeFmt:  formatSeconds(empTimeSec),
    interactionSec, interactionFmt: formatSeconds(interactionSec),
    billingDwellSec, billingDwellFmt: formatSeconds(billingDwellSec),
    captureRate, floorExploreRate, billingRate,
    healthScore,
  };
}

export { formatSeconds };
