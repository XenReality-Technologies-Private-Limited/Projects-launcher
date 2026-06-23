import initSqlJs from 'sql.js';

let _sqlPromise = null;
function getSqlInstance() {
  if (!_sqlPromise) {
    _sqlPromise = initSqlJs({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${file}`,
    });
  }
  return _sqlPromise;
}

function parseHMSToSeconds(str) {
  if (typeof str === 'number') return str;
  const parts = String(str).split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(str) || 0;
}

function n(val) { return Number(val) || 0; }

export async function loadForSQL1(url = '/uspolo.db') {
  const SQL = await getSqlInstance();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cannot load database (${response.status}). Update CLOUDFRONT_BASE_URL in src/main.js.`);
  }
  const buffer = await response.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));

  const stmt = db.prepare(`
    SELECT timestamp,
           store_entry,    trial_entry,    upstairs_entry,    billing_done,    passerby,
           store_entry_man,    trial_entry_man,    upstairs_entry_man,    billing_done_man,
           store_entry_woman,  trial_entry_woman,  upstairs_entry_woman,  billing_done_woman
    FROM csv_data
    ORDER BY timestamp ASC
  `);

  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      timestampSec:  parseHMSToSeconds(r.timestamp),

      // Totals
      storeEntry:    n(r.store_entry),
      trialEntry:    n(r.trial_entry),
      upstairsEntry: n(r.upstairs_entry),
      billingDone:   n(r.billing_done),
      passerby:      n(r.passerby),

      // Demographics — male
      storeEntryMan:    n(r.store_entry_man),
      trialEntryMan:    n(r.trial_entry_man),
      upstairsEntryMan: n(r.upstairs_entry_man),
      billingDoneMan:   n(r.billing_done_man),

      // Demographics — female
      storeEntryWoman:    n(r.store_entry_woman),
      trialEntryWoman:    n(r.trial_entry_woman),
      upstairsEntryWoman: n(r.upstairs_entry_woman),
      billingDoneWoman:   n(r.billing_done_woman),
    });
  }
  stmt.free();
  db.close();
  return rows;
}
