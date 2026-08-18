const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'microboss.db');
const FILE = path.join(__dirname, '..', 'data', 'ministers.tsv');

if (!fs.existsSync(FILE)) {
  console.error('NOT FOUND: data/ministers.tsv');
  process.exit(1);
}

function parseLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === '\t') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

let raw = fs.readFileSync(FILE, 'utf8');
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '');
const header = parseLine(lines[0]);
const col = (name) => header.findIndex((h) => h && h.toUpperCase() === name);
const get = (r, idx) => (idx >= 0 ? (r[idx] || '').trim() : '');

const db = new DatabaseSync(DB_PATH);
const upsert = db.prepare(`INSERT INTO ministers (name, designation, ministry, fb_link, created_at) VALUES (?, ?, ?, '', ?) ON CONFLICT(name) DO UPDATE SET designation = excluded.designation, ministry = excluded.ministry`);
const captions = db.prepare(`SELECT * FROM captions WHERE category = 'Minister' ORDER BY id`).all();
const setMin = db.prepare(`UPDATE captions SET minister_name = ? WHERE id = ?`);

let minCount = 0, matched = 0, unmatched = 0;

for (let i = 1; i < lines.length; i++) {
  const r = parseLine(lines[i]);
  const name = get(r, col('MINISTER NAME'));
  const designation = get(r, col('DESIGNATION'));
  const ministry = get(r, col('MINISTRY'));
  if (!name) { console.log(`row ${i}: missing name, skipped`); continue; }
  upsert.run(name, designation, ministry, new Date().toISOString());
  minCount++;

  const c = captions.find((x) => x.minister_name === '' && x.caption.endsWith(name));
  if (c) { setMin.run(name, c.id); matched++; }
  else { unmatched++; console.log(`unmatched caption for: ${name}`); }
}

console.log(`Ministers upserted: ${minCount}`);
console.log(`Captions linked: ${matched}, Unmatched: ${unmatched}`);
console.log(`Total ministers in DB: ${db.prepare('SELECT COUNT(*) n FROM ministers').get().n}`);
