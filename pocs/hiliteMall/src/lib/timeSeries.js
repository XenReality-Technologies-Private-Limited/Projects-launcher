// Builds per-channel time series indexed by integer seconds from video start.
// Returns: { [channel]: { counts: number[], personIds: Array<number[]> } }
//   counts[sec]    — how many re-id matched persons are on this floor at `sec`
//   personIds[sec] — which canonical_ids are present at `sec`
export function buildTimeSeries(floorVisits, videoConfig) {
  const series = {};

  for (const [channel, cfg] of Object.entries(videoConfig)) {
    const videoStart = new Date(cfg.startTime).getTime();
    const visits = floorVisits.filter((v) => v.channel === channel);

    let maxSec = 60;
    for (const v of visits) {
      const exitOffset = (new Date(v.exit_time).getTime() - videoStart) / 1000;
      if (exitOffset > maxSec) maxSec = exitOffset;
    }
    maxSec = Math.ceil(maxSec) + 5;

    const counts = new Array(maxSec).fill(0);
    const personIds = Array.from({ length: maxSec }, () => []);

    for (const v of visits) {
      const entryOffset = (new Date(v.entry_time).getTime() - videoStart) / 1000;
      const exitOffset = (new Date(v.exit_time).getTime() - videoStart) / 1000;
      const start = Math.max(0, Math.floor(entryOffset));
      // floor: person is "present" at integer second s only if they haven't exited yet at s+1
      const end = Math.min(maxSec - 1, Math.floor(exitOffset));
      for (let s = start; s <= end; s++) {
        counts[s]++;
        personIds[s].push(v.canonical_id);
      }
    }

    series[channel] = { counts, personIds };
  }

  return series;
}
