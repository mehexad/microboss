const path = require('path');
const fs = require('fs');
const { db } = require(path.join(__dirname, '..', 'lib', 'db.js'));

const SRC = '/Users/mehexad/Desktop/Channel_One_Daily_Program_Schedule.tsv';
const lines = fs.readFileSync(SRC, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '');

const WDAY = { Saturday: 6, Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };
const WNAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BN_WNAMES = { Saturday: 'শনিবার', Sunday: 'রবিবার', Monday: 'সোমবার', Tuesday: 'মঙ্গলবার', Wednesday: 'বুধবার', Thursday: 'বৃহস্পতিবার', Friday: 'শুক্রবার' };
const WEEKDAYS = ['শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার'];

function parseTime(t) {
  const m = String(t).match(/(\d{1,2})\.(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function saturdayOfWeek(today) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const offset = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const header = lines[0].split('\t').map(c => c.trim());
const timeIdx = header.findIndex(h => h.toLowerCase() === 'time');
const dayCols = header.slice(timeIdx + 1).map(h => h.trim());

const entries = [];
for (const line of lines.slice(1)) {
  const cells = line.split('\t').map(c => c.trim());
  const timeRange = cells[timeIdx];
  if (!timeRange || !timeRange.includes('-')) continue;
  const start = parseTime(timeRange.split('-')[0]);
  if (!start) continue;
  dayCols.forEach((dayName, ci) => {
    const raw = cells[timeIdx + 1 + ci];
    if (!raw) return;
    const title = raw.replace(/•\s*$/, '').trim();
    if (!title) return;
    entries.push({ day: WDAY[dayName], title, slot_time: start, raw });
  });
}

const sat = saturdayOfWeek(new Date());
const dateOf = {};
for (const [name, dow] of Object.entries(WDAY)) {
  const d = new Date(sat);
  let add = (dow - sat.getDay() + 7) % 7;
  d.setDate(d.getDate() + add);
  dateOf[dow] = ymd(d);
}
const weekdayOf = Object.fromEntries(Object.entries(WDAY).map(([name, dow]) => [dow, BN_WNAMES[name]]));

console.log('Schedule dates:', WNAMES.map((n, i) => `${n}: ${dateOf[i]}`).join(' | '));
console.log('Parsed entries:', entries.length);

const backup = db.prepare('SELECT * FROM programs').all();
if (backup.length) {
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'programs_backup_before_weekly.json'), JSON.stringify(backup, null, 2));
  console.log('Backup saved:', backup.length, 'programs');
}

const del = db.prepare('DELETE FROM programs');
console.log('Deleted existing:', del.run().changes);

const ins = db.prepare(`INSERT INTO programs (slot_time, weekday, date, title, created_by, created_at, duration, prog_title, prog_desc, prog_keywords, prog_tags, clip_title, clip_desc, clip_keywords, clip_tags)
  VALUES (?, ?, '', ?, 1, ?, 0, ?, '', '', '', '', '', '', '')`);

let added = 0;
for (const e of entries) {
  const now = new Date().toISOString();
  ins.run(e.slot_time, weekdayOf[e.day], e.title, now, e.title);
  added++;
}
console.log('Inserted:', added);

const byDay = db.prepare(`SELECT COALESCE(NULLIF(weekday, ''), date) AS day, COUNT(*) n FROM programs GROUP BY day`).all();
for (const r of byDay) console.log(r.day, r.n);
