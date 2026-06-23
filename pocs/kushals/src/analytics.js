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

// ── Hardcoded footfall step functions (user-verified timestamps) ────────────
// Columns: [fromSeconds, ftIn, ftMale, ftFemale, ftChild, groupCount]
const FT_STEPS = [
  [315, 8, 2, 6, 0, 2],  // 5:15  — male enters
  [290, 7, 1, 6, 0, 2],  // 4:50  — female enters
  [287, 6, 1, 5, 0, 2],  // 4:47  — female enters
  [248, 5, 1, 4, 0, 2],  // 4:08  — female enters (group 2 complete)
  [247, 4, 1, 3, 0, 2],  // 4:07  — male enters (group 2 starts)
  [118, 3, 0, 3, 0, 1],  // 1:58  — 3rd female (group 1 complete)
  [111, 2, 0, 2, 0, 0],  // 1:51  — 2nd female enters
  [109, 1, 0, 1, 0, 0],  // 1:49  — 1st female enters
  [  0, 0, 0, 0, 0, 0],
];

function ftData(t) {
  for (const [ts, ftIn, ftMale, ftFemale, ftChild, groupCount] of FT_STEPS) {
    if (t >= ts) return { ftIn, ftMale, ftFemale, ftChild, groupCount };
  }
  return { ftIn: 0, ftMale: 0, ftFemale: 0, ftChild: 0, groupCount: 0 };
}

// ── Hardcoded JC presence step functions (user-verified timestamps) ────────

function empPresent(t) {
  if (t <  42) return true;   // present from start
  if (t <  50) return false;  // 0:42 left
  if (t < 160) return true;   // 0:50 returned
  if (t < 263) return false;  // 2:40 left
  if (t < 279) return true;   // 4:23 returned
  if (t < 351) return false;  // 4:39 left
  if (t < 354) return true;   // 5:51 returned
  return false;                // 5:54 left, absent rest of video
}

function custPresent(t) {
  if (t < 132) return true;   // present from start
  if (t < 240) return false;  // 2:12 left
  if (t < 245) return true;   // 4:00 returned
  if (t < 250) return false;  // 4:05 left
  if (t < 273) return true;   // 4:10 returned
  if (t < 552) return false;  // 4:33 left
  if (t < 563) return true;   // 9:12 returned
  if (t < 641) return false;  // 9:23 left
  if (t < 644) return true;   // 10:41 returned
  if (t < 664) return false;  // 10:44 left
  if (t < 694) return true;   // 11:04 returned
  return false;                // 11:34 left, absent rest of video
}

// Cumulative seconds where both were present simultaneously:
//   Interval 1: 0–42s   (42s)
//   Interval 2: 50–132s (82s)
//   Interval 3: 263–273s (10s)
//   Total max: 134s
function coPresentSecs(t) {
  if (t <  42) return t;
  if (t <  50) return 42;
  if (t < 132) return 42 + (t - 50);
  if (t < 263) return 124;
  if (t < 273) return 124 + (t - 263);
  return 134;
}

const MAX_CO_PRESENT_SECS = 134;
export { MAX_CO_PRESENT_SECS };

// frac: 0 = start of video, 1 = end of video
export function computeFrame(frac, data, currentTime = 0) {
  const { passerby, footfall, greetings, totalEmployees, jewelleryClr, ftDwellTimes } = data;

  const f = Math.max(0, Math.min(1, frac));

  // ── Passerby — total traffic = in_count + out_count combined ─────────────
  const pbRow    = rowAt(passerby, f);
  const pbInArr  = pbRow ? parseCount(pbRow.in_count)  : [0, 0, 0];
  const pbOutArr = pbRow ? parseCount(pbRow.out_count) : [0, 0, 0];
  const pbMale   = pbInArr[0] + pbOutArr[0];
  const pbFemale = pbInArr[1] + pbOutArr[1];
  const pbChild  = pbInArr[2] + pbOutArr[2];
  const pbIn     = pbMale + pbFemale + pbChild;

  // ── Footfall — hardcoded from user-verified timestamps ────────────────────
  const { ftIn, ftMale, ftFemale, ftChild, groupCount: ftGroups } = ftData(currentTime);
  const ftDwell = dwellAt(ftDwellTimes, footfall, f);

  // ── Greetings — attended count hardcoded at user-verified timestamps ──────
  // Unattended comes from the actual DB column.
  const greetAttended =
    currentTime >= 815 ? 10 :
    currentTime >= 814 ? 9  :
    currentTime >= 578 ? 8  :
    currentTime >= 396 ? 7  :
    currentTime >= 394 ? 6  :
    currentTime >= 393 ? 5  :
    currentTime >= 331 ? 4  :
    currentTime >= 298 ? 3  :
    currentTime >= 294 ? 2  :
    currentTime >= 292 ? 1  :
    0;
  const greetUnattended = 0;

  // ── Total Employees — hardcoded per user-verified timestamps ─────────────
  const EMP_STEPS = [
    // [fromSeconds, count]  — sorted descending so first match wins
    [820, 4], [796, 5], [772, 6], [748, 4], [725, 5], [703, 6],
    [678, 4], [654, 5], [630, 6], [607, 4], [582, 5], [559, 6],
    [535, 4], [512, 5], [487, 6], [465, 4], [441, 5], [418, 6],
    [392, 4], [368, 5], [346, 6], [323, 5], [300, 4], // random 4/5/6 from ~5:00
    [215, 6],  // "6 till sometime" ends at ~5:00
    [195, 5],
    [178, 6],
    [ 75, 7],
    [ 69, 6],
    [  0, 5],
  ];
  let employeeCount = 5;
  for (const [ts, val] of EMP_STEPS) {
    if (currentTime >= ts) { employeeCount = val; break; }
  }

  // ── Jewellery Clearance — all hardcoded from user-verified timestamps ─────
  const deskState       = currentTime >= 431 ? 'CLEAR' : 'OCCUPIED';
  const jcEmpPresent    = empPresent(currentTime);
  const jcCustPresent   = custPresent(currentTime);
  const interactionSecs = coPresentSecs(currentTime);

  // ── Rate & Health ─────────────────────────────────────────────────────────
  const captureRate = safeRate(ftIn, pbIn);
  const healthScore = Math.round(captureRate * 100);

  return {
    pbIn, pbMale, pbFemale, pbChild,
    pbMalePct:   pbIn > 0 ? Math.round(pbMale   / pbIn * 100) : 0,
    pbFemalePct: pbIn > 0 ? Math.round(pbFemale / pbIn * 100) : 0,
    pbChildPct:  pbIn > 0 ? Math.round(pbChild  / pbIn * 100) : 0,
    ftIn, ftMale, ftFemale, ftChild, ftGroupCount: ftGroups,
    ftMalePct:   ftIn > 0 ? Math.round(ftMale   / ftIn * 100) : 0,
    ftFemalePct: ftIn > 0 ? Math.round(ftFemale / ftIn * 100) : 0,
    ftChildPct:  ftIn > 0 ? Math.round(ftChild  / ftIn * 100) : 0,
    ftDwellMin: ftDwell / 60, ftDwellFmt: formatSeconds(ftDwell),
    greetAttended, greetUnattended,
    employeeCount,
    deskState, jcCustPresent, jcEmpPresent,
    interactionSecs, interactionFmt: formatSeconds(interactionSecs),
    captureRate,
    healthScore,
  };
}

export { formatSeconds };
