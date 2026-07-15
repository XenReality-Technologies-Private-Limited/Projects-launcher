import initSqlJs from 'sql.js';
import { DB_URL } from '../config';

async function createDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/${file}`,
  });

  const response = await fetch(`${DB_URL}?v=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch persons.db: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return new SQL.Database(new Uint8Array(buffer));
}

function loadFloorVisits(db) {
  const stmt = db.prepare('SELECT * FROM floor_visits ORDER BY entry_time ASC');
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      id: r.id,
      canonical_id: r.canonical_id,
      channel: r.channel,
      entry_time: r.entry_time,
      exit_time: r.exit_time,
      duration_seconds: Number(r.duration_seconds) || 0,
    });
  }
  stmt.free();
  return rows;
}

function loadPersons(db) {
  const stmt = db.prepare('SELECT * FROM persons ORDER BY canonical_id ASC');
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      canonical_id: r.canonical_id,
      matched_ids: (() => { try { return JSON.parse(r.matched_ids || '[]'); } catch { return []; } })(),
      floors_visited: Number(r.floors_visited) || 0,
    });
  }
  stmt.free();
  return rows;
}

function loadTransitions(db) {
  const stmt = db.prepare('SELECT * FROM transitions ORDER BY exit_time ASC');
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      id: r.id,
      canonical_id: r.canonical_id,
      from_channel: r.from_channel,
      to_channel: r.to_channel,
      exit_time: r.exit_time,
      entry_time: r.entry_time,
      travel_seconds: Number(r.travel_seconds) || 0,
    });
  }
  stmt.free();
  return rows;
}

export async function initDatabase() {
  const db = await createDatabase();
  return {
    floorVisits: loadFloorVisits(db),
    persons: loadPersons(db),
    transitions: loadTransitions(db),
  };
}
