const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'microboss.db');
const FILE_CANDIDATES = [
  path.join(__dirname, '..', 'data', 'ministers.tsv'),
  path.join(__dirname, '..', 'data', 'ministers.csv'),
];

const file = FILE_CANDIDATES.find((p) => fs.existsSync(p));
if (!file) {
  console.error('NOT FOUND: data/ministers.tsv or data/ministers.csv — save the table there first.');
  process.exit(1);
}

const delim = file.endsWith('.csv') ? ',' : '\t';

function parseLine(line, d) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === d) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

let raw = fs.readFileSync(file, 'utf8');
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
const rows = raw.split(/\r?\n/).filter((l) => l.trim() !== '');
if (rows.length < 2) {
  console.error('Empty file. Expected a header row + data rows.');
  process.exit(1);
}

const header = parseLine(rows[0], delim);
const col = (name) => {
  if (name === 'KEYWORDS') {
    const i = header.findIndex((h) => /^KEYWORD/i.test(h));
    return i;
  }
  const i = header.findIndex((h) => h && h.toUpperCase() === name);
  return i;
};
const tagIdx = [];
header.forEach((h, i) => { if (/^TAG/i.test(h)) tagIdx.push(i); });

const get = (r, idx) => (idx >= 0 ? (r[idx] || '').trim() : '');

const db = new DatabaseSync(DB_PATH);
const admin = db.prepare(`SELECT id FROM users WHERE role IN ('owner','manager') ORDER BY id LIMIT 1`).get();
if (!admin) { console.error('No owner/manager user found to attribute captions.'); process.exit(1); }

const exists = db.prepare(`SELECT id FROM captions WHERE category = ? AND caption = ?`);
const insert = db.prepare(`INSERT INTO captions (category, caption, description, hashtag, keywords, tags, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

let added = 0, skipped = 0, errors = 0;
const now = new Date().toISOString();

for (let i = 1; i < rows.length; i++) {
  const r = parseLine(rows[i], delim);
  const title = get(r, col('LIVE TITLE'));
  const name = get(r, col('MINISTER NAME'));
  const designation = get(r, col('DESIGNATION'));
  const ministry = get(r, col('MINISTRY'));
  const hashtag = get(r, col('HASHTAG'));
  let keywords = get(r, col('KEYWORDS'));
  keywords = keywords.replace(/^\(+|\)+$/g, '').trim();
  const tags = tagIdx.map((ti) => get(r, ti)).filter(Boolean).join(', ');

  if (!title) { errors++; console.log(`row ${i}: missing LIVE TITLE, skipped`); continue; }

  const description = title + (hashtag ? '\n' + hashtag : '');
  const category = 'Minister';

  if (exists.get(category, title)) { skipped++; continue; }
  insert.run(category, title, description, hashtag, keywords, tags, now, admin.id);
  added++;
}

console.log(`File: ${path.basename(file)}`);
console.log(`Added: ${added}, Skipped (duplicate): ${skipped}, Errors: ${errors}`);
