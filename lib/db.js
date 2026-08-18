const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'microboss.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    office_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    fb_link TEXT DEFAULT '',
    office_name TEXT DEFAULT '',
    designation TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL,
    trashed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sponsors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    note TEXT DEFAULT '',
    content_type TEXT DEFAULT '',
    start_date TEXT,
    deadline TEXT,
    total_videos INTEGER NOT NULL DEFAULT 0,
    daily_target INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    completed_at TEXT,
    deleted_at TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_date TEXT NOT NULL,
    upload_time TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL,
    slug TEXT DEFAULT '',
    headline TEXT DEFAULT '',
    category TEXT DEFAULT 'video',
    sponsor_id INTEGER,
    youtube TEXT DEFAULT '',
    facebook TEXT DEFAULT '',
    instagram TEXT DEFAULT '',
    threads TEXT DEFAULT '',
    x TEXT DEFAULT '',
    tiktok TEXT DEFAULT '',
    bluesky TEXT DEFAULT '',
    reddit TEXT DEFAULT '',
    pinterest TEXT DEFAULT '',
    dailymotion TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0,
    sheet_row INTEGER,
    slot_label TEXT DEFAULT '',
    trashed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sponsor_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    kind TEXT DEFAULT 'deadline',
    created_at TEXT NOT NULL,
    read INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    poster_name TEXT DEFAULT '',
    designation TEXT DEFAULT '',
    department TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    days INTEGER DEFAULT 7,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    trashed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_time TEXT NOT NULL,
    date TEXT DEFAULT '',
    weekday TEXT DEFAULT '',
    title TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    prog_title TEXT DEFAULT '',
    prog_desc TEXT DEFAULT '',
    prog_keywords TEXT DEFAULT '',
    prog_tags TEXT DEFAULT '',
    clip_title TEXT DEFAULT '',
    clip_desc TEXT DEFAULT '',
    clip_keywords TEXT DEFAULT '',
    clip_tags TEXT DEFAULT '',
    duration INTEGER DEFAULT 0,
    trashed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS special_programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slot_time TEXT NOT NULL,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    trashed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS trash (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    label TEXT DEFAULT '',
    detail TEXT DEFAULT '',
    deleted_by INTEGER DEFAULT 0,
    deleted_at TEXT NOT NULL,
    remarks TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    check_in_at TEXT NOT NULL,
    check_out_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oneeye_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'youtube',
    url TEXT NOT NULL,
    channel_id TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS captions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL DEFAULT 'General',
    caption TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    created_by INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ministers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    designation TEXT DEFAULT '',
    ministry TEXT DEFAULT '',
    fb_link TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS party_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

function migrate() {
  const cols = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);
  if (!cols.includes('office_name')) db.exec(`ALTER TABLE users ADD COLUMN office_name TEXT DEFAULT ''`);
  if (!cols.includes('designation')) db.exec(`ALTER TABLE users ADD COLUMN designation TEXT DEFAULT ''`);
  if (!cols.includes('whatsapp')) db.exec(`ALTER TABLE users ADD COLUMN whatsapp TEXT DEFAULT ''`);
  if (!cols.includes('birth_date')) db.exec(`ALTER TABLE users ADD COLUMN birth_date TEXT DEFAULT ''`);
  if (!cols.includes('nickname')) db.exec(`ALTER TABLE users ADD COLUMN nickname TEXT DEFAULT ''`);
  if (!cols.includes('trashed_at')) db.exec(`ALTER TABLE users ADD COLUMN trashed_at TEXT`);
  if (!cols.includes('status')) db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`);
  const ncols = db.prepare(`PRAGMA table_info(notifications)`).all().map(c => c.name);
  if (!ncols.includes('level')) db.exec(`ALTER TABLE notifications ADD COLUMN level TEXT DEFAULT 'warn'`);
  if (!ncols.includes('ref_id')) db.exec(`ALTER TABLE notifications ADD COLUMN ref_id INTEGER DEFAULT 0`);
  const scols = db.prepare(`PRAGMA table_info(sponsors)`).all().map(c => c.name);
  if (!scols.includes('content_type')) db.exec(`ALTER TABLE sponsors ADD COLUMN content_type TEXT DEFAULT ''`);
  if (!scols.includes('completed_at')) db.exec(`ALTER TABLE sponsors ADD COLUMN completed_at TEXT`);
  if (!scols.includes('deleted_at')) db.exec(`ALTER TABLE sponsors ADD COLUMN deleted_at TEXT`);
  const ccols = db.prepare(`PRAGMA table_info(contents)`).all().map(c => c.name);
  if (!ccols.includes('trashed_at')) db.exec(`ALTER TABLE contents ADD COLUMN trashed_at TEXT`);
  if (!ccols.includes('category')) db.exec(`ALTER TABLE contents ADD COLUMN category TEXT DEFAULT 'video'`);
  if (!ccols.includes('slot_label')) db.exec(`ALTER TABLE contents ADD COLUMN slot_label TEXT DEFAULT ''`);
  const tcols = db.prepare(`PRAGMA table_info(notices)`).all().map(c => c.name);
  if (!tcols.includes('trashed_at')) db.exec(`ALTER TABLE notices ADD COLUMN trashed_at TEXT`);
  if (!tcols.includes('designation')) db.exec(`ALTER TABLE notices ADD COLUMN designation TEXT DEFAULT ''`);
  if (!tcols.includes('department')) db.exec(`ALTER TABLE notices ADD COLUMN department TEXT DEFAULT ''`);
  const capCols = db.prepare(`PRAGMA table_info(captions)`).all().map(c => c.name);
  if (!capCols.includes('description')) db.exec(`ALTER TABLE captions ADD COLUMN description TEXT DEFAULT ''`);
  if (!capCols.includes('keywords')) db.exec(`ALTER TABLE captions ADD COLUMN keywords TEXT DEFAULT ''`);
  if (!capCols.includes('tags')) db.exec(`ALTER TABLE captions ADD COLUMN tags TEXT DEFAULT ''`);
  if (!capCols.includes('hashtag')) db.exec(`ALTER TABLE captions ADD COLUMN hashtag TEXT DEFAULT ''`);
  if (!capCols.includes('minister_name')) db.exec(`ALTER TABLE captions ADD COLUMN minister_name TEXT DEFAULT ''`);
  const trashCols = db.prepare(`PRAGMA table_info(trash)`).all().map(c => c.name);
  if (!trashCols.includes('remarks')) db.exec(`ALTER TABLE trash ADD COLUMN remarks TEXT DEFAULT ''`);
  const pcols = db.prepare(`PRAGMA table_info(programs)`).all().map(c => c.name);
  const pFields = ['prog_title', 'prog_desc', 'prog_keywords', 'prog_tags', 'clip_title', 'clip_desc', 'clip_keywords', 'clip_tags'];
  for (const f of pFields) {
    if (!pcols.includes(f)) db.exec(`ALTER TABLE programs ADD COLUMN ${f} TEXT DEFAULT ''`);
  }
  if (!pcols.includes('duration')) db.exec(`ALTER TABLE programs ADD COLUMN duration INTEGER DEFAULT 0`);
  if (!pcols.includes('date')) db.exec(`ALTER TABLE programs ADD COLUMN date TEXT DEFAULT ''`);
  if (!pcols.includes('weekday')) db.exec(`ALTER TABLE programs ADD COLUMN weekday TEXT DEFAULT ''`);
  db.exec(`UPDATE programs SET weekday = CASE strftime('%w', date)
    WHEN '0' THEN 'রবিবার' WHEN '1' THEN 'সোমবার' WHEN '2' THEN 'মঙ্গলবার'
    WHEN '3' THEN 'বুধবার' WHEN '4' THEN 'বৃহস্পতিবার' WHEN '5' THEN 'শুক্রবার'
    WHEN '6' THEN 'শনিবার' ELSE '' END
    WHERE weekday = '' AND date != ''`);
}
migrate();

const stmts = {
  createUser: db.prepare(`INSERT INTO users (username, nickname, office_id, email, phone, whatsapp, fb_link, office_name, designation, birth_date, password_hash, role, status, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  findUserByIdentifier: db.prepare(`SELECT * FROM users WHERE (username = ? OR email = ? OR nickname = ?) AND trashed_at IS NULL`),
  findUserById: db.prepare(`SELECT * FROM users WHERE id = ? AND trashed_at IS NULL`),
  findUserAny: db.prepare(`SELECT * FROM users WHERE id = ?`),
  findUserByUsername: db.prepare(`SELECT * FROM users WHERE username = ?`),
  findUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  findUserByOfficeId: db.prepare(`SELECT * FROM users WHERE office_id = ?`),
  countUsers: db.prepare(`SELECT COUNT(*) AS c FROM users WHERE trashed_at IS NULL`),
  listUsers: db.prepare(`SELECT id, username, office_id, email, phone, whatsapp, fb_link, office_name, designation, birth_date, role, status, created_at FROM users WHERE trashed_at IS NULL AND status = 'active' ORDER BY username`),
  listPendingUsers: db.prepare(`SELECT id, username, office_id, email, phone, whatsapp, fb_link, office_name, designation, birth_date, role, status, created_at FROM users WHERE trashed_at IS NULL AND status = 'pending' ORDER BY created_at DESC`),
  listBirthdaysToday: db.prepare(`SELECT id, username, designation, birth_date FROM users WHERE trashed_at IS NULL AND status = 'active' AND substr(birth_date, 6) = ?`),
  setRole: db.prepare(`UPDATE users SET role = ? WHERE id = ?`),
  setUserStatus: db.prepare(`UPDATE users SET status = ? WHERE id = ?`),
  setDesignation: db.prepare(`UPDATE users SET designation = ? WHERE id = ?`),
  setPassword: db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`),
  setBirthDate: db.prepare(`UPDATE users SET birth_date = ? WHERE id = ?`),
  updateProfile: db.prepare(`UPDATE users SET username = ?, office_id = ?, email = ?, phone = ?, whatsapp = ?, fb_link = ?, office_name = ?, designation = ?, password_hash = ? WHERE id = ?`),
  updateUserProfile: db.prepare(`UPDATE users SET username = ?, nickname = ?, office_id = ?, office_name = ?, designation = ?, birth_date = ?, email = ?, phone = ?, whatsapp = ?, fb_link = ? WHERE id = ?`),
  deleteUser: db.prepare(`UPDATE users SET trashed_at = ? WHERE id = ?`),
  restoreUser: db.prepare(`UPDATE users SET trashed_at = NULL WHERE id = ?`),
  purgeUser: db.prepare(`DELETE FROM users WHERE id = ?`),
  deleteNotificationsForUser: db.prepare(`DELETE FROM notifications WHERE user_id = ?`),

  createSession: db.prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`),
  findSession: db.prepare(`SELECT * FROM sessions WHERE token = ?`),
  touchSession: db.prepare(`UPDATE sessions SET expires_at = ? WHERE token = ?`),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),
  deleteAllSessionsForUser: db.prepare(`DELETE FROM sessions WHERE user_id = ?`),
  deleteExpiredSessions: db.prepare(`DELETE FROM sessions WHERE expires_at < ?`),
  listOneEye: db.prepare(`SELECT * FROM oneeye_sources ORDER BY id`),
  findOneEye: db.prepare(`SELECT * FROM oneeye_sources WHERE id = ?`),
  createOneEye: db.prepare(`INSERT INTO oneeye_sources (name, kind, url, channel_id, created_at) VALUES (?, ?, ?, ?, ?)`),
  updateOneEye: db.prepare(`UPDATE oneeye_sources SET name = ?, url = ?, channel_id = ? WHERE id = ?`),
  deleteOneEye: db.prepare(`DELETE FROM oneeye_sources WHERE id = ?`),

  createCaption: db.prepare(`INSERT INTO captions (category, caption, description, hashtag, keywords, tags, minister_name, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  findCaption: db.prepare(`SELECT * FROM captions WHERE id = ?`),
  listCaptions: db.prepare(`SELECT * FROM captions ORDER BY lower(category), id DESC`),
  updateCaption: db.prepare(`UPDATE captions SET category = ?, caption = ?, description = ?, hashtag = ?, keywords = ?, tags = ?, minister_name = ? WHERE id = ?`),
  listMinisters: db.prepare(`SELECT * FROM ministers ORDER BY name COLLATE NOCASE`),
  findMinisterById: db.prepare(`SELECT * FROM ministers WHERE id = ?`),
  upsertMinister: db.prepare(`INSERT INTO ministers (name, designation, ministry, fb_link, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET designation = excluded.designation, ministry = excluded.ministry, fb_link = CASE WHEN excluded.fb_link != '' THEN excluded.fb_link ELSE ministers.fb_link END`),
  setMinisterLink: db.prepare(`UPDATE ministers SET fb_link = ? WHERE id = ?`),
  deleteCaption: db.prepare(`DELETE FROM captions WHERE id = ?`),

  listParties: db.prepare(`SELECT * FROM parties ORDER BY name COLLATE NOCASE`),
  findPartyById: db.prepare(`SELECT * FROM parties WHERE id = ?`),
  findPartyByName: db.prepare(`SELECT * FROM parties WHERE name = ?`),
  createParty: db.prepare(`INSERT INTO parties (name, created_at) VALUES (?, ?)`),
  updateParty: db.prepare(`UPDATE parties SET name = ? WHERE id = ?`),
  deleteParty: db.prepare(`DELETE FROM parties WHERE id = ?`),
  deletePartyPages: db.prepare(`DELETE FROM party_pages WHERE party_id = ?`),
  listPartyPages: db.prepare(`SELECT * FROM party_pages WHERE party_id = ? ORDER BY name COLLATE NOCASE`),
  findPartyPage: db.prepare(`SELECT * FROM party_pages WHERE id = ?`),
  createPartyPage: db.prepare(`INSERT INTO party_pages (party_id, name, url, created_at) VALUES (?, ?, ?, ?)`),
  updatePartyPage: db.prepare(`UPDATE party_pages SET name = ?, url = ? WHERE id = ?`),
  deletePartyPage: db.prepare(`DELETE FROM party_pages WHERE id = ?`),

  createSponsor: db.prepare(`INSERT INTO sponsors (name, note, content_type, start_date, deadline, total_videos, daily_target, status, completed_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  updateSponsor: db.prepare(`UPDATE sponsors SET name = ?, note = ?, content_type = ?, start_date = ?, deadline = ?, total_videos = ?, daily_target = ?, status = ?,
    completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE NULL END WHERE id = ?`),
  setSponsorStatus: db.prepare(`UPDATE sponsors SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE completed_at END WHERE id = ?`),
  resetSponsorCompletion: db.prepare(`UPDATE sponsors SET status = 'active', completed_at = NULL WHERE id = ?`),
  findSponsor: db.prepare(`SELECT * FROM sponsors WHERE id = ?`),
  listSponsors: db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM contents WHERE sponsor_id = s.id AND trashed_at IS NULL) AS content_count FROM sponsors s WHERE s.deleted_at IS NULL ORDER BY s.created_at DESC`),
  deleteSponsor: db.prepare(`UPDATE sponsors SET deleted_at = ? WHERE id = ?`),
  restoreSponsor: db.prepare(`UPDATE sponsors SET deleted_at = NULL WHERE id = ?`),
  purgeSponsor: db.prepare(`DELETE FROM sponsors WHERE id = ?`),

  createContent: db.prepare(`INSERT INTO contents
    (upload_date, upload_time, uploaded_by, slug, headline, category, sponsor_id,
     youtube, facebook, instagram, threads, x, tiktok, bluesky, reddit, pinterest, dailymotion,
     slot_label, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`),
  findContent: db.prepare(`SELECT * FROM contents WHERE id = ? AND trashed_at IS NULL`),
  findContentAny: db.prepare(`SELECT * FROM contents WHERE id = ?`),
  listContents: db.prepare(`SELECT * FROM contents WHERE trashed_at IS NULL ORDER BY upload_date DESC, upload_time DESC`),
  listRecentContents: db.prepare(`SELECT * FROM contents WHERE trashed_at IS NULL ORDER BY id DESC LIMIT ?`),
  updateContent: db.prepare(`UPDATE contents SET upload_date = ?, upload_time = ?, slug = ?, headline = ?, category = ?, sponsor_id = ?,
    youtube = ?, facebook = ?, instagram = ?, threads = ?, x = ?, tiktok = ?, bluesky = ?, reddit = ?, pinterest = ?, dailymotion = ?,
    slot_label = ? WHERE id = ?`),
  deleteContent: db.prepare(`UPDATE contents SET trashed_at = ? WHERE id = ?`),
  restoreContent: db.prepare(`UPDATE contents SET trashed_at = NULL WHERE id = ?`),
  purgeContent: db.prepare(`DELETE FROM contents WHERE id = ?`),
  deleteUploadNotifications: db.prepare(`DELETE FROM notifications WHERE kind = 'upload' AND ref_id = ?`),
  countContentsInMonth: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date BETWEEN ? AND ?`),
  countVideoInMonth: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date BETWEEN ? AND ? AND category = 'video'`),
  countStaticInMonth: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date BETWEEN ? AND ? AND category = 'static'`),
  countSponsoredInMonth: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date BETWEEN ? AND ? AND sponsor_id IS NOT NULL`),
  countFreeInMonth: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date BETWEEN ? AND ? AND sponsor_id IS NULL`),
  countByMemberInMonth: db.prepare(`SELECT uploaded_by, COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date BETWEEN ? AND ? GROUP BY uploaded_by`),
  countByMemberAllTime: db.prepare(`SELECT uploaded_by, COUNT(*) AS c FROM contents WHERE trashed_at IS NULL GROUP BY uploaded_by`),
  countByMemberToday: db.prepare(`SELECT uploaded_by, COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date = ? GROUP BY uploaded_by`),
  countByMemberCategoryInMonth: db.prepare(`SELECT uploaded_by, category, COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date BETWEEN ? AND ? GROUP BY uploaded_by, category`),
  countForSponsorOnDate: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE sponsor_id = ? AND trashed_at IS NULL AND upload_date = ?`),
  countForSponsorByDayInRange: db.prepare(`SELECT upload_date, COUNT(*) AS c FROM contents WHERE sponsor_id = ? AND trashed_at IS NULL AND upload_date BETWEEN ? AND ? GROUP BY upload_date`),
  countForSponsorUpTo: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE sponsor_id = ? AND trashed_at IS NULL AND upload_date <= ?`),
  countForSponsorInRange: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE sponsor_id = ? AND trashed_at IS NULL AND upload_date BETWEEN ? AND ?`),
  countForSponsorTotal: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE sponsor_id = ? AND trashed_at IS NULL`),
  listForSponsor: db.prepare(`SELECT * FROM contents WHERE sponsor_id = ? AND trashed_at IS NULL ORDER BY upload_date DESC, upload_time DESC`),
  listForSponsorOnDate: db.prepare(`SELECT * FROM contents WHERE sponsor_id = ? AND trashed_at IS NULL AND upload_date = ? ORDER BY upload_time DESC`),
  listForSponsorRange: db.prepare(`SELECT * FROM contents WHERE sponsor_id = ? AND trashed_at IS NULL AND upload_date BETWEEN ? AND ? ORDER BY upload_date DESC, upload_time DESC`),
  listForUser: db.prepare(`SELECT * FROM contents WHERE uploaded_by = ? AND trashed_at IS NULL ORDER BY upload_date DESC, upload_time DESC`),
  listForUserRange: db.prepare(`SELECT * FROM contents WHERE uploaded_by = ? AND trashed_at IS NULL AND upload_date BETWEEN ? AND ? ORDER BY upload_date DESC, upload_time DESC`),
  listForSlotLabel: db.prepare(`SELECT c.*, u.username AS uploaded_by_name, s.name AS sponsor_name FROM contents c LEFT JOIN users u ON u.id = c.uploaded_by LEFT JOIN sponsors s ON s.id = c.sponsor_id WHERE c.trashed_at IS NULL AND c.slot_label = ? ORDER BY c.upload_date DESC, c.upload_time DESC`),
  listForSlotLabelRange: db.prepare(`SELECT c.*, u.username AS uploaded_by_name, s.name AS sponsor_name FROM contents c LEFT JOIN users u ON u.id = c.uploaded_by LEFT JOIN sponsors s ON s.id = c.sponsor_id WHERE c.trashed_at IS NULL AND c.slot_label = ? AND c.upload_date BETWEEN ? AND ? ORDER BY c.upload_date DESC, c.upload_time DESC`),
  listForSlotTime: db.prepare(`SELECT c.*, u.username AS uploaded_by_name, s.name AS sponsor_name FROM contents c LEFT JOIN users u ON u.id = c.uploaded_by LEFT JOIN sponsors s ON s.id = c.sponsor_id WHERE c.trashed_at IS NULL AND (c.slot_label IS NULL OR c.slot_label = '') AND c.upload_time = ? ORDER BY c.upload_date DESC, c.upload_time DESC`),
  listForSlotTimeRange: db.prepare(`SELECT c.*, u.username AS uploaded_by_name, s.name AS sponsor_name FROM contents c LEFT JOIN users u ON u.id = c.uploaded_by LEFT JOIN sponsors s ON s.id = c.sponsor_id WHERE c.trashed_at IS NULL AND (c.slot_label IS NULL OR c.slot_label = '') AND c.upload_time = ? AND c.upload_date BETWEEN ? AND ? ORDER BY c.upload_date DESC, c.upload_time DESC`),

  createNotification: db.prepare(`INSERT INTO notifications (user_id, sponsor_id, message, kind, level, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  existsNotificationToday: db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND sponsor_id = ? AND kind = ? AND created_at LIKE ?`),
  existsNotificationRefToday: db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND kind = ? AND ref_id = ? AND created_at LIKE ?`),
  existsBirthdayRefToday: db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND kind = 'birthday' AND ref_id = ? AND date(created_at, 'localtime') = ?`),
  listNotificationsForUser: db.prepare(`SELECT n.*, s.name AS sponsor_name FROM notifications n LEFT JOIN sponsors s ON s.id = n.sponsor_id WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 100`),
  unreadCountForUser: db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0`),
  markAllRead: db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`),
  listAllUserIds: db.prepare(`SELECT id, username FROM users WHERE trashed_at IS NULL AND status = 'active'`),
  listManagerUserIds: db.prepare(`SELECT id, username FROM users WHERE trashed_at IS NULL AND status = 'active' AND (role IN ('owner','senior','admin') OR lower(designation) = 'manager')`),
  bumpVersion: db.prepare(`INSERT INTO settings (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`),
  getVersion: db.prepare(`SELECT value FROM settings WHERE key = ?`),
  setSetting: db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),

  createNotice: db.prepare(`INSERT INTO notices (message, poster_name, designation, department, phone, email, days, created_at, expires_at, created_by)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  findNotice: db.prepare(`SELECT * FROM notices WHERE id = ? AND trashed_at IS NULL`),
  findNoticeAny: db.prepare(`SELECT * FROM notices WHERE id = ?`),
  listActiveNotices: db.prepare(`SELECT * FROM notices WHERE trashed_at IS NULL AND expires_at > ? ORDER BY id DESC`),
  listAllNotices: db.prepare(`SELECT * FROM notices WHERE trashed_at IS NULL ORDER BY id DESC LIMIT 50`),
  deleteNotice: db.prepare(`UPDATE notices SET trashed_at = ? WHERE id = ?`),
  restoreNotice: db.prepare(`UPDATE notices SET trashed_at = NULL WHERE id = ?`),
  purgeNotice: db.prepare(`DELETE FROM notices WHERE id = ?`),
  latestNoticeId: db.prepare(`SELECT COALESCE(MAX(id), 0) AS c FROM notices`),

  createProgram: db.prepare(`INSERT INTO programs (slot_time, date, weekday, title, created_by, created_at, duration, prog_title, prog_desc, prog_keywords, prog_tags, clip_title, clip_desc, clip_keywords, clip_tags)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  findProgram: db.prepare(`SELECT * FROM programs WHERE id = ? AND trashed_at IS NULL`),
  findProgramAny: db.prepare(`SELECT * FROM programs WHERE id = ?`),
  findProgramSlot: db.prepare(`SELECT * FROM programs WHERE trashed_at IS NULL AND weekday = ? AND slot_time = ? ORDER BY id LIMIT 1`),
  listPrograms: db.prepare(`SELECT * FROM programs WHERE trashed_at IS NULL ORDER BY CASE weekday WHEN 'শনিবার' THEN 0 WHEN 'রবিবার' THEN 1 WHEN 'সোমবার' THEN 2 WHEN 'মঙ্গলবার' THEN 3 WHEN 'বুধবার' THEN 4 WHEN 'বৃহস্পতিবার' THEN 5 WHEN 'শুক্রবার' THEN 6 ELSE 7 END, slot_time`),
  updateProgram: db.prepare(`UPDATE programs SET slot_time = ?, date = ?, weekday = ?, title = ?, duration = ?, prog_title = ?, prog_desc = ?, prog_keywords = ?, prog_tags = ?, clip_title = ?, clip_desc = ?, clip_keywords = ?, clip_tags = ? WHERE id = ?`),
  deleteProgram: db.prepare(`UPDATE programs SET trashed_at = ? WHERE id = ?`),
  restoreProgram: db.prepare(`UPDATE programs SET trashed_at = NULL WHERE id = ?`),
  purgeProgram: db.prepare(`DELETE FROM programs WHERE id = ?`),

  createSpecialProgram: db.prepare(`INSERT INTO special_programs (title, slot_time, date_from, date_to, duration, active, created_by, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`),
  findSpecialProgram: db.prepare(`SELECT * FROM special_programs WHERE id = ? AND trashed_at IS NULL`),
  findSpecialProgramAny: db.prepare(`SELECT * FROM special_programs WHERE id = ?`),
  findSpecialOverlap: db.prepare(`SELECT * FROM special_programs WHERE trashed_at IS NULL AND slot_time = ? AND date_from <= ? AND date_to >= ? ORDER BY id LIMIT 1`),
  listSpecialPrograms: db.prepare(`SELECT * FROM special_programs WHERE trashed_at IS NULL ORDER BY date_from DESC, slot_time`),
  updateSpecialProgram: db.prepare(`UPDATE special_programs SET title = ?, slot_time = ?, date_from = ?, date_to = ?, duration = ? WHERE id = ?`),
  setSpecialActive: db.prepare(`UPDATE special_programs SET active = ? WHERE id = ?`),
  deleteSpecialProgram: db.prepare(`UPDATE special_programs SET trashed_at = ? WHERE id = ?`),
  restoreSpecialProgram: db.prepare(`UPDATE special_programs SET trashed_at = NULL WHERE id = ?`),
  purgeSpecialProgram: db.prepare(`DELETE FROM special_programs WHERE id = ?`),

  createTrash: db.prepare(`INSERT INTO trash (entity, entity_id, label, detail, deleted_by, deleted_at, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  listTrash: db.prepare(`SELECT * FROM trash ORDER BY deleted_at DESC`),
  findTrashById: db.prepare(`SELECT * FROM trash WHERE id = ?`),
  deleteTrash: db.prepare(`DELETE FROM trash WHERE id = ?`),
  deleteTrashByEntity: db.prepare(`DELETE FROM trash WHERE entity = ? AND entity_id = ?`),

  countContentsToday: db.prepare(`SELECT COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date = ?`),
  countByDayInRange: db.prepare(`SELECT upload_date, COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date BETWEEN ? AND ? GROUP BY upload_date ORDER BY upload_date`),
  countBySlotOnDate: db.prepare(`SELECT upload_time, COUNT(*) AS c FROM contents WHERE trashed_at IS NULL AND upload_date = ? GROUP BY upload_time ORDER BY upload_time`),
  platformDistributionInMonth: db.prepare(`
    SELECT
      SUM(CASE WHEN youtube != '' THEN 1 ELSE 0 END) AS youtube,
      SUM(CASE WHEN facebook != '' THEN 1 ELSE 0 END) AS facebook,
      SUM(CASE WHEN instagram != '' THEN 1 ELSE 0 END) AS instagram,
      SUM(CASE WHEN threads != '' THEN 1 ELSE 0 END) AS threads,
      SUM(CASE WHEN x != '' THEN 1 ELSE 0 END) AS x,
      SUM(CASE WHEN tiktok != '' THEN 1 ELSE 0 END) AS tiktok,
      SUM(CASE WHEN bluesky != '' THEN 1 ELSE 0 END) AS bluesky,
      SUM(CASE WHEN reddit != '' THEN 1 ELSE 0 END) AS reddit,
      SUM(CASE WHEN pinterest != '' THEN 1 ELSE 0 END) AS pinterest,
      SUM(CASE WHEN dailymotion != '' THEN 1 ELSE 0 END) AS dailymotion
    FROM contents WHERE trashed_at IS NULL AND upload_date BETWEEN ? AND ?
  `),

  getSetting: db.prepare(`SELECT value FROM settings WHERE key = ?`),
  setSetting: db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`),

  createCheckIn: db.prepare(`INSERT INTO checkins (user_id, check_in_at, check_out_at, created_at) VALUES (?, ?, NULL, ?)`),
  findOpenCheckIn: db.prepare(`SELECT * FROM checkins WHERE user_id = ? AND check_out_at IS NULL ORDER BY id DESC LIMIT 1`),
  findCheckInById: db.prepare(`SELECT * FROM checkins WHERE id = ?`),
  checkoutCheckIn: db.prepare(`UPDATE checkins SET check_out_at = ? WHERE id = ?`),
  deleteCheckIn: db.prepare(`DELETE FROM checkins WHERE id = ?`),
  listCheckInsToday: db.prepare(`SELECT c.* FROM checkins c WHERE date(c.check_in_at) = date('now', 'localtime') ORDER BY c.check_in_at DESC`),
  listAllCheckIns: db.prepare(`SELECT c.*, u.username, u.office_id, u.designation FROM checkins c JOIN users u ON u.id = c.user_id ORDER BY c.check_in_at`),
  countMembersCheckedInToday: db.prepare(`SELECT COUNT(DISTINCT user_id) AS c FROM checkins WHERE check_out_at IS NULL AND date(check_in_at) = date('now', 'localtime')`)
};

function nowIso() {
  const d = new Date();
  return d.toISOString();
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthRange(year, month) {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { first, last };
}

function monthName(year, month) {
  const names = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  return `${names[month - 1]} ${year}`;
}

function deleteAllSessionsForUser(userId) {
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}

module.exports = { db, stmts, nowIso, todayStr, monthRange, monthName, DATA_DIR };
