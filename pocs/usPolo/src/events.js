export async function loadZoneEvents(url = '/zone_events.csv') {
  let response;
  try {
    response = await fetch(url);
  } catch {
    return [];
  }
  if (!response.ok) {
    console.warn('zone_events.csv not found — journey and dwell analysis will be unavailable.');
    return [];
  }
  const text = await response.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // header: frame,timestamp_s,camera_name,gid,zone_name,event_type,dwell_s,entry_ts
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 6) continue;
    rows.push({
      frame:       Number(parts[0])         || 0,
      timestampS:  parseFloat(parts[1])     || 0,
      cameraName:  (parts[2] || '').trim(),
      gid:         Number(parts[3])         || 0,
      zoneName:    (parts[4] || '').trim().toLowerCase(),
      eventType:   (parts[5] || '').trim().toLowerCase(),
      dwellS:      parseFloat(parts[6])     || 0,
      entryTs:     parseFloat(parts[7])     || 0,
    });
  }
  return rows;
}
