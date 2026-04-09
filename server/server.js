const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '2mb' }));

const STORE_PATH = path.join('/data', 'configs.json');

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return {}; }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store), 'utf8');
}

function generateId(store) {
  let id;
  do {
    id = crypto.randomBytes(6).toString('base64url').slice(0, 8);
  } while (store[id]);
  return id;
}

app.post('/api/config', (req, res) => {
  const config = req.body;
  if (!config || !Array.isArray(config.kpis)) {
    return res.status(400).json({ error: 'Invalid config' });
  }
  const store = loadStore();
  const id = generateId(store);
  store[id] = config;
  saveStore(store);
  res.json({ id });
});

app.get('/api/config/:id', (req, res) => {
  const store = loadStore();
  const config = store[req.params.id];
  if (!config) return res.status(404).json({ error: 'Not found' });
  res.json(config);
});

app.listen(3001, () => console.log('API listening on :3001'));
