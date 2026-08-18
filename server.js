const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, stmts, nowIso, todayStr, monthRange, monthName, DATA_DIR } = require('./lib/db');
const auth = require('./lib/auth');
const access = require('./lib/access');
const tracking = require('./lib/tracking');
const pdf = require('./lib/pdf');
const checkin = require('./lib/checkin');
const news = require('./lib/news');
const oneeye = require('./lib/oneeye');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.use((req, res, next) => {
  const token = req.headers.cookie
    ? req.headers.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(auth.COOKIE_NAME + '='))
    : null;
  if (token) {
    const t = token.slice(auth.COOKIE_NAME.length + 1);
    req.user = auth.getUserFromToken(t);
    req.sessionToken = t;
  } else {
    req.user = null;
    req.sessionToken = null;
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  next();
}

function requireManager(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  if (!auth.isManager(req.user)) return res.status(403).json({ error: 'Only the owner or a Manager can do this.' });
  next();
}

function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  if (!auth.isOwner(req.user)) return res.status(403).json({ error: 'Only the owner can do this.' });
  next();
}

function safeUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, nickname: u.nickname || '', office_id: u.office_id, office_name: u.office_name, designation: u.designation, email: u.email, phone: u.phone, whatsapp: u.whatsapp, fb_link: u.fb_link, birth_date: u.birth_date || '', role: u.role, status: u.status || 'active', access: auth.access(u), created_at: u.created_at };
}

function isSecure() {
  return process.env.NODE_ENV === 'production' || process.env.FLY_APP_NAME;
}

function setSessionCookie(res, token) {
  const secure = isSecure() ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${auth.COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=31536000; SameSite=Lax${secure}`);
}

function clearSessionCookie(res) {
  const secure = isSecure() ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${auth.COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0${secure}`);
}

const PLATFORMS = ['youtube', 'facebook', 'instagram', 'threads', 'x', 'tiktok', 'bluesky', 'reddit', 'pinterest', 'dailymotion'];

function parseDate(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null;
}

function validIntlNumber(v) {
  return /^\+[1-9]\d{0,2}[- ]?\d{6,13}$/.test(String(v || '').trim());
}

function normalizeCategory(c) {
  return c === 'static' ? 'static' : 'video';
}

function maybeCompleteSponsor(sponsorId) {
  if (!sponsorId) return;
  const s = stmts.findSponsor.get(sponsorId);
  if (!s || s.deleted_at || s.status === 'completed') return;
  const done = stmts.countForSponsorTotal.get(s.id).c;
  if (s.total_videos > 0 && done >= s.total_videos) {
    stmts.setSponsorStatus.run('completed', 'completed', nowIso(), s.id);
  }
}

function revertIfNoLongerComplete(sponsorId) {
  if (!sponsorId) return;
  const s = stmts.findSponsor.get(sponsorId);
  if (!s || s.deleted_at || s.status !== 'completed') return;
  const done = stmts.countForSponsorTotal.get(s.id).c;
  if (s.total_videos <= 0 || done < s.total_videos) {
    stmts.resetSponsorCompletion.run(s.id);
  }
}

function ensureSponsorDailyCompleteNotifications() {
  const today = todayStr();
  const users = stmts.listAllUserIds.all();
  if (!users.length) return;
  const sponsors = stmts.listSponsors.all().filter(s => s.daily_target > 0 && (s.status === 'active' || s.status === 'completed'));
  for (const s of sponsors) {
    const done = stmts.countForSponsorOnDate.get(s.id, today).c;
    if (done < s.daily_target) continue;
    const msg = `🏆 "${s.name}" স্পনসরের আজকের দৈনিক টার্গেট সম্পন্ন হয়েছে — এখন পর্যন্ত ${done}/${s.daily_target} ভিডিও আপলোড হয়েছে!`;
    for (const u of users) {
      if (stmts.existsNotificationToday.get(u.id, s.id, 'complete', today + '%').c) continue;
      stmts.createNotification.run(u.id, s.id, msg, 'complete', 'green', 0, nowIso());
    }
  }
}

function trashEntity(entity, entity_id, label, detail, deletedBy, remarks) {
  stmts.deleteTrashByEntity.run(entity, entity_id);
  stmts.createTrash.run(entity, entity_id, label, detail, deletedBy || 0, nowIso(), remarks || '');
}

function restoreEntity(t) {
  if (t.entity === 'content') {
    const row = stmts.findContentAny.get(t.entity_id);
    if (!row) return { ok: false, error: 'This content no longer exists.' };
    if (row.trashed_at) {
      stmts.restoreContent.run(t.entity_id);
      maybeCompleteSponsor(row.sponsor_id);
      ensureSponsorDailyCompleteNotifications();
    }
  } else if (t.entity === 'sponsor') {
    const row = stmts.findSponsor.get(t.entity_id);
    if (!row) return { ok: false, error: 'This sponsor no longer exists.' };
    stmts.restoreSponsor.run(t.entity_id);
  } else if (t.entity === 'notice') {
    const row = stmts.findNoticeAny.get(t.entity_id);
    if (!row) return { ok: false, error: 'This notice no longer exists.' };
    if (row.trashed_at) stmts.restoreNotice.run(t.entity_id);
  } else if (t.entity === 'program') {
    const row = stmts.findProgramAny.get(t.entity_id);
    if (!row) return { ok: false, error: 'This program no longer exists.' };
    if (row.trashed_at) stmts.restoreProgram.run(t.entity_id);
  } else if (t.entity === 'special') {
    const row = stmts.findSpecialProgramAny.get(t.entity_id);
    if (!row) return { ok: false, error: 'This special program no longer exists.' };
    if (row.trashed_at) stmts.restoreSpecialProgram.run(t.entity_id);
  } else if (t.entity === 'user') {
    const row = stmts.findUserAny.get(t.entity_id);
    if (!row) return { ok: false, error: 'This user no longer exists.' };
    if (row.trashed_at) stmts.restoreUser.run(t.entity_id);
  } else {
    return { ok: false, error: 'Unknown item type.' };
  }
  stmts.deleteTrash.run(t.id);
  return { ok: true };
}

function purgeEntity(t) {
  if (t.entity === 'content') {
    const row = stmts.findContentAny.get(t.entity_id);
    if (row) {
      stmts.deleteUploadNotifications.run(t.entity_id);
      stmts.purgeContent.run(t.entity_id);
    }
  } else if (t.entity === 'sponsor') {
    const row = stmts.findSponsor.get(t.entity_id);
    if (row) stmts.purgeSponsor.run(t.entity_id);
  } else if (t.entity === 'notice') {
    const row = stmts.findNoticeAny.get(t.entity_id);
    if (row) stmts.purgeNotice.run(t.entity_id);
  } else if (t.entity === 'program') {
    const row = stmts.findProgramAny.get(t.entity_id);
    if (row) stmts.purgeProgram.run(t.entity_id);
  } else if (t.entity === 'special') {
    const row = stmts.findSpecialProgramAny.get(t.entity_id);
    if (row) stmts.purgeSpecialProgram.run(t.entity_id);
  } else if (t.entity === 'user') {
    const row = stmts.findUserAny.get(t.entity_id);
    if (row) {
      stmts.deleteAllSessionsForUser.run(t.entity_id);
      stmts.deleteNotificationsForUser.run(t.entity_id);
      stmts.purgeUser.run(t.entity_id);
    }
  }
  stmts.deleteTrash.run(t.id);
}

function backfillSponsorCompletions() {
  stmts.listSponsors.all().forEach(s => {
    revertIfNoLongerComplete(s.id);
    if (s.status === 'completed' && !s.completed_at) stmts.setSponsorStatus.run('completed', 'completed', nowIso(), s.id);
    maybeCompleteSponsor(s.id);
  });
}

/* ============ AUTH ============ */

app.post('/api/register', (req, res) => {
  const { username, nickname, office_id, office_name, designation, email, phone, whatsapp, fb_link, password } = req.body || {};
  const birth_date = parseDate(req.body && req.body.birth_date) || '';
  if (!birth_date) return res.status(400).json({ error: 'Birth date is required.' });
  if (!username || !nickname || !office_id || !office_name || !designation || !email || !phone || !whatsapp || !fb_link || !password) {
    return res.status(400).json({ error: 'All fields are required: Full Name, Nickname, Office ID, Office Name, Designation, Email, Phone, WhatsApp Number, Facebook Link and Password.' });
  }
  if (!access.isValidDesignation(designation)) {
    return res.status(400).json({ error: 'Please choose a valid Designation from the list.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid email required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!validIntlNumber(phone)) return res.status(400).json({ error: 'ফোন নম্বর অবশ্যই দেশের কোডসহ (+880...) লিখতে হবে — যেকোনো দেশের কোড হতে পারে।' });
  if (!validIntlNumber(whatsapp)) return res.status(400).json({ error: 'WhatsApp নম্বরও অবশ্যই দেশের কোডসহ (+880...) লিখতে হবে — যেকোনো দেশের কোড হতে পারে।' });
  if (stmts.findUserByUsername.get(username)) return res.status(400).json({ error: 'Username already taken.' });
  if (stmts.findUserByOfficeId.get(office_id)) return res.status(400).json({ error: 'Office ID already registered.' });
  if (stmts.findUserByEmail.get(email)) return res.status(400).json({ error: 'Email already registered.' });

  const isFirst = stmts.countUsers.get().c === 0;
  const role = isFirst ? 'owner' : 'member';
  const status = isFirst ? 'active' : 'pending';
  const info = stmts.createUser.run(username, nickname, office_id, email, phone || '', whatsapp || '', fb_link || '', office_name || '', designation || '', birth_date, auth.hashPassword(password), role, status, nowIso());
  if (!isFirst) {
    const managers = stmts.listManagerUserIds.all();
    for (const m of managers) {
      stmts.createNotification.run(m.id, 0, `🆕 নতুন রেজিস্ট্রেশন রিকোয়েস্ট: ${username} (${designation}) — Team পেজ থেকে Approve/Reject করুন।`, 'registration', 'warn', info.lastInsertRowid, nowIso());
    }
    bumpVersion('users');
    return res.json({ registered: true, pending: true, message: 'আপনার রেজিস্ট্রেশন জমা হয়েছে! Owner/Manager অনুমোদন দিলে লগইন করতে পারবেন।' });
  }
  const user = stmts.findUserById.get(info.lastInsertRowid);
  const token = auth.createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: safeUser(user) });
});

app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'Enter nickname / username / email and password.' });
  const user = stmts.findUserByIdentifier.get(identifier, identifier, identifier);
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  if (user.status === 'pending') {
    return res.status(403).json({ error: 'আপনার রেজিস্ট্রেশন এখনো অনুমোদিত হয়নি — Owner/Manager অনুমোদন দিলে আপনি লগইন করতে পারবেন।' });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({ error: 'আপনার রেজিস্ট্রেশনটি অনুমোদিত হয়নি। বিস্তারিত জানতে Owner/Manager-এর সাথে যোগাযোগ করুন।' });
  }
  const token = auth.createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: safeUser(user) });
});

app.post('/api/logout', requireAuth, (req, res) => {
  if (req.sessionToken) stmts.deleteSession.run(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  const u = safeUser(req.user);
  try {
    const r = stmts.getVersion.get('fab_pos_' + u.id);
    if (r && r.value) u.fab_pos = JSON.parse(r.value);
  } catch (e) {}
  res.json({ user: u });
});

app.put('/api/me/fab-pos', requireAuth, (req, res) => {
  const b = req.body || {};
  const pos = {};
  for (const key of ['quickUploadFab', 'sponsorTrackerFab']) {
    const p = b[key];
    if (p && typeof p.left === 'number' && typeof p.top === 'number') pos[key] = { left: Math.round(p.left), top: Math.round(p.top) };
  }
  if (!Object.keys(pos).length) return res.status(400).json({ error: 'No valid positions.' });
  stmts.setSetting.run('fab_pos_' + req.user.id, JSON.stringify(pos));
  res.json({ ok: true, fab_pos: pos });
});

/* ============ CHECK-IN / CHECK-OUT ============ */

app.get('/api/checkin', requireAuth, (req, res) => {
  const st = checkin.status(req.user.id);
  const users = stmts.listUsers.all();
  const nameMap = {};
  const officeMap = {};
  const phoneMap = {};
  for (const u of users) {
    nameMap[u.id] = u.username;
    officeMap[u.id] = u.office_id;
    phoneMap[u.id] = u.phone;
  }
  st.today = st.today.map(r => ({
    ...r,
    username: nameMap[r.user_id] || '#' + r.user_id,
    office_id: officeMap[r.user_id] || '',
    phone: phoneMap[r.user_id] || ''
  }));
  st.manager = access.canManageSponsors(req.user);
  res.json(st);
});

app.post('/api/checkin', requireAuth, (req, res) => {
  const r = checkin.checkIn(req.user.id);
  bumpVersion('checkin');
  res.json({ ok: true, created: r.created, active: !!(r.record && !r.record.check_out_at), check_in_at: r.record ? r.record.check_in_at : null });
});

app.post('/api/checkout', requireAuth, (req, res) => {
  const c = checkin.checkOut(req.user.id);
  bumpVersion('checkin');
  res.json({ ok: true, checked_out: !!c, check_out_at: c ? c.check_out_at : null });
});

app.delete('/api/checkin/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const row = stmts.findCheckInById.get(id);
  if (!row) return res.status(404).json({ error: 'Check-in record not found.' });
  if (row.user_id !== req.user.id) {
    return res.status(403).json({ error: 'শুধু নিজের check-in রেকর্ড ডিলিট করতে পারবেন — Admin/Manager/Owner-ও অন্যেরটা মুছতে পারবে না।' });
  }
  stmts.deleteCheckIn.run(id);
  bumpVersion('checkin');
  res.json({ ok: true });
});

app.get('/api/news', requireAuth, async (req, res) => {
  try {
    const headlines = await news.getNews();
    res.json({ headlines });
  } catch (e) {
    res.json({ headlines: [] });
  }
});

/* ============ ONE EYE ============ */

function validYouTubeUrl(u) {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(String(u || ''));
}

app.get('/api/oneeye', requireAuth, async (req, res) => {
  try {
    const sources = stmts.listOneEye.all();
    const tracked = await oneeye.getOneEye(sources);
    res.json({ sources: tracked });
  } catch (e) {
    res.json({ sources: [] });
  }
});

app.post('/api/oneeye', requireManager, async (req, res) => {
  const { name, url } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Channel name is required.' });
  if (!validYouTubeUrl(url)) return res.status(400).json({ error: 'Please enter a valid YouTube channel URL (youtube.com/@handle or /channel/UC...).' });
  const channelId = await oneeye.resolveChannelIdWithFeed(String(url).trim());
  if (!channelId) return res.status(400).json({ error: 'Could not find this YouTube channel or it has no public videos.' });
  const info = stmts.createOneEye.run(String(name).trim(), 'youtube', String(url).trim(), channelId, nowIso());
  res.json({ ok: true, source: { id: info.lastInsertRowid, name: String(name).trim(), kind: 'youtube', url: String(url).trim(), channel_id: channelId } });
});

app.put('/api/oneeye/:id', requireManager, async (req, res) => {
  const id = Number(req.params.id);
  const existing = stmts.findOneEye.get(id);
  if (!existing) return res.status(404).json({ error: 'Source not found.' });
  const { name, url } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Channel name is required.' });
  const finalUrl = String(url || '').trim() || existing.url;
  if (!validYouTubeUrl(finalUrl)) return res.status(400).json({ error: 'Please enter a valid YouTube channel URL.' });
  let channelId = existing.channel_id;
  if (existing.url !== finalUrl) {
    channelId = await oneeye.resolveChannelIdWithFeed(finalUrl);
    if (!channelId) return res.status(400).json({ error: 'Could not find this YouTube channel or it has no public videos.' });
  }
  stmts.updateOneEye.run(String(name).trim(), finalUrl, channelId, id);
  res.json({ ok: true, source: { id, name: String(name).trim(), url: finalUrl, channel_id: channelId } });
});

app.delete('/api/oneeye/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  if (!stmts.findOneEye.get(id)) return res.status(404).json({ error: 'Source not found.' });
  stmts.deleteOneEye.run(id);
  res.json({ ok: true });
});

/* ============ RANKING ============ */

app.get('/api/ranking', requireAuth, (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || (now.getMonth() + 1);
  const { first, last } = monthRange(year, month);
  const today = todayStr();

  const allRows = stmts.countByMemberAllTime.all();
  const monthRows = stmts.countByMemberInMonth.all(first, last);
  const todayRows = stmts.countByMemberToday.all(today);
  const catRows = stmts.countByMemberCategoryInMonth.all(first, last);

  const allMap = {}; for (const r of allRows) allMap[r.uploaded_by] = r.c;
  const monthMap = {}; for (const r of monthRows) monthMap[r.uploaded_by] = r.c;
  const todayMap = {}; for (const r of todayRows) todayMap[r.uploaded_by] = r.c;
  const catMap = {};
  for (const r of catRows) catMap[r.uploaded_by + ':' + r.category] = r.c;

  const ranking = stmts.listUsers.all().map(u => ({
    user_id: u.id,
    username: u.username,
    designation: u.designation || '',
    office_name: u.office_name || '',
    all_time: allMap[u.id] || 0,
    month: monthMap[u.id] || 0,
    today: todayMap[u.id] || 0,
    videos: catMap[u.id + ':video'] || 0,
    statics: catMap[u.id + ':static'] || 0
  })).sort((a, b) => b.all_time - a.all_time);

  res.json({ year, month, month_name: monthName(year, month), ranking });
});

app.get('/api/designations', (req, res) => {
  res.json({ designations: access.DESIGNATIONS, labels: access.ACCESS_LABELS });
});

app.get('/api/birthdays', requireAuth, (req, res) => {
  const now = new Date();
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  res.json({ birthdays: stmts.listBirthdaysToday.all(md) });
});

/* ============ USERS / TEAM ============ */

app.get('/api/users', requireAuth, (req, res) => {
  res.json({
    users: stmts.listUsers.all().map(u => ({ ...u, access: auth.access(u) })),
    pending: stmts.listPendingUsers.all().map(u => ({ ...u, access: auth.access(u) }))
  });
});

app.post('/api/users/:id/approve', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const user = stmts.findUserAny.get(id);
  if (!user || user.trashed_at) return res.status(404).json({ error: 'User not found.' });
  if (user.status !== 'pending') return res.status(400).json({ error: 'এই ব্যবহারকারী অনুমোদনের অপেক্ষায় নেই।' });
  stmts.setUserStatus.run('active', id);
  stmts.createNotification.run(id, 0, '✅ আপনার রেজিস্ট্রেশন অনুমোদিত হয়েছে! এখন লগইন করতে পারবেন।', 'notify', 'green', 0, nowIso());
  bumpVersion('users');
  res.json({ ok: true, user: safeUser(stmts.findUserById.get(id)) });
});

app.post('/api/users/:id/reject', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const user = stmts.findUserAny.get(id);
  if (!user || user.trashed_at) return res.status(404).json({ error: 'User not found.' });
  if (user.status !== 'pending') return res.status(400).json({ error: 'এই ব্যবহারকারী অনুমোদনের অপেক্ষায় নেই।' });
  stmts.setUserStatus.run('rejected', id);
  stmts.deleteAllSessionsForUser.run(id);
  bumpVersion('users');
  res.json({ ok: true });
});

app.put('/api/users/:id/role', requireOwner, (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body || {};
  const allowed = ['owner', 'senior', 'member'];
  if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  const user = stmts.findUserById.get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'owner' && role !== 'owner') return res.status(400).json({ error: 'Cannot demote the owner.' });
  stmts.setRole.run(role, id);
  bumpVersion('users');
  res.json({ ok: true, user: safeUser(stmts.findUserById.get(id)) });
});

app.put('/api/users/:id/designation', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const { designation } = req.body || {};
  if (!access.isValidDesignation(designation)) return res.status(400).json({ error: 'Invalid designation.' });
  const user = stmts.findUserById.get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'owner') return res.status(400).json({ error: 'Cannot change the owner\'s designation.' });
  stmts.setDesignation.run(designation, id);
  bumpVersion('users');
  res.json({ ok: true, user: safeUser(stmts.findUserById.get(id)) });
});

app.put('/api/users/:id/password', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const { password, confirm } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  if (password !== confirm) return res.status(400).json({ error: 'Passwords do not match.' });
  const user = stmts.findUserById.get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'owner') return res.status(400).json({ error: 'Cannot reset the owner\'s password.' });
  stmts.setPassword.run(auth.hashPassword(password), id);
  stmts.deleteAllSessionsForUser.run(id);
  res.json({ ok: true, message: 'Password reset. The user will need to log in again.' });
});

app.put('/api/users/:id/profile', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const username = String(b.username || '').trim();
  const office_id = String(b.office_id || '').trim();
  const office_name = String(b.office_name || '').trim();
  const designation = String(b.designation || '').trim();
  const birth_date = parseDate(b.birth_date) || '';
  const email = String(b.email || '').trim();
  const phone = String(b.phone || '').trim();
  const whatsapp = String(b.whatsapp || '').trim();
  const fb_link = String(b.fb_link || '').trim();
  if (!username) return res.status(400).json({ error: 'User name is required.' });
  if (!office_id) return res.status(400).json({ error: 'Office ID is required.' });
  if (!office_name) return res.status(400).json({ error: 'Office name is required.' });
  if (!access.isValidDesignation(designation)) return res.status(400).json({ error: 'Please choose a valid Designation.' });
  if (!birth_date) return res.status(400).json({ error: 'Birth date is required.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid email required.' });
  if (phone && !validIntlNumber(phone)) return res.status(400).json({ error: 'ফোন নম্বর অবশ্যই দেশের কোডসহ (+880...) লিখতে হবে — যেকোনো দেশের কোড হতে পারে।' });
  if (whatsapp && !validIntlNumber(whatsapp)) return res.status(400).json({ error: 'WhatsApp নম্বরও অবশ্যই দেশের কোডসহ (+880...) লিখতে হবে — যেকোনো দেশের কোড হতে পারে।' });
  const user = stmts.findUserById.get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'owner') return res.status(400).json({ error: 'Cannot edit the owner\'s profile.' });
  const clash = stmts.findUserByUsername.get(username) || stmts.findUserByOfficeId.get(office_id) || stmts.findUserByEmail.get(email);
  if (clash && clash.id !== id) return res.status(400).json({ error: 'Username / Office ID / Email already used by another user.' });
  stmts.updateUserProfile.run(username, office_id, office_name, designation, birth_date, email, phone, whatsapp, fb_link, id);
  bumpVersion('users');
  res.json({ ok: true, user: safeUser(stmts.findUserById.get(id)) });
});

app.delete('/api/users/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
  const user = stmts.findUserById.get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'owner') return res.status(400).json({ error: 'The owner account cannot be deleted.' });
  stmts.deleteAllSessionsForUser.run(id);
  stmts.deleteNotificationsForUser.run(id);
  stmts.deleteUser.run(nowIso(), id);
  trashEntity('user', id, user.username, user.designation || '', req.user.id);
  bumpVersion('users');
  bumpVersion('trash');
  res.json({ ok: true, message: 'User moved to trash.' });
});

app.put('/api/me/birth-date', requireAuth, (req, res) => {
  const birth_date = parseDate(req.body && req.body.birth_date) || '';
  if (!birth_date) return res.status(400).json({ error: 'Please choose a valid birth date.' });
  stmts.setBirthDate.run(birth_date, req.user.id);
  bumpVersion('users');
  res.json({ ok: true, user: safeUser(stmts.findUserById.get(req.user.id)) });
});

app.put('/api/me/profile', requireAuth, (req, res) => {
  const id = req.user.id;
  const b = req.body || {};
  const username = String(b.username || '').trim();
  const nickname = String(b.nickname || '').trim();
  const office_id = String(b.office_id || '').trim();
  const office_name = String(b.office_name || '').trim();
  const birth_date = parseDate(b.birth_date) || '';
  const email = String(b.email || '').trim();
  const phone = String(b.phone || '').trim();
  const whatsapp = String(b.whatsapp || '').trim();
  const fb_link = String(b.fb_link || '').trim();
  if (!username) return res.status(400).json({ error: 'Full name is required.' });
  if (!nickname) return res.status(400).json({ error: 'Nickname is required.' });
  if (!office_id) return res.status(400).json({ error: 'Office ID is required.' });
  if (!office_name) return res.status(400).json({ error: 'Office name is required.' });
  if (!birth_date) return res.status(400).json({ error: 'Birth date is required.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid email required.' });
  if (phone && !validIntlNumber(phone)) return res.status(400).json({ error: 'ফোন নম্বর অবশ্যই দেশের কোডসহ (+880...) লিখতে হবে — যেকোনো দেশের কোড হতে পারে।' });
  if (whatsapp && !validIntlNumber(whatsapp)) return res.status(400).json({ error: 'WhatsApp নম্বরও অবশ্যই দেশের কোডসহ (+880...) লিখতে হবে — যেকোনো দেশের কোড হতে পারে।' });
  const user = stmts.findUserById.get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const clash = stmts.findUserByUsername.get(username) || stmts.findUserByOfficeId.get(office_id) || stmts.findUserByEmail.get(email);
  if (clash && clash.id !== id) return res.status(400).json({ error: 'Username / Office ID / Email already used by another user.' });
  stmts.updateUserProfile.run(username, nickname, office_id, office_name, user.designation, birth_date, email, phone, whatsapp, fb_link, id);
  bumpVersion('users');
  res.json({ ok: true, user: safeUser(stmts.findUserById.get(id)) });
});

app.post('/api/password/change', requireAuth, (req, res) => {
  const { current_password, new_password, confirm } = req.body || {};
  const user = stmts.findUserById.get(req.user.id);
  if (!user || !auth.verifyPassword(current_password || '', user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  if (new_password !== confirm) return res.status(400).json({ error: 'Passwords do not match.' });
  stmts.setPassword.run(auth.hashPassword(new_password), user.id);
  res.json({ ok: true, message: 'Password changed.' });
});

app.get('/api/team/upload-stats', requireAuth, (req, res) => {
  const d = new Date();
  const stats = tracking.monthlyStats(d.getFullYear(), d.getMonth() + 1);
  res.json(stats);
});

/* ============ DASHBOARD ============ */

app.get('/api/dashboard', requireAuth, (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || (now.getMonth() + 1);
  const stats = tracking.monthlyStats(year, month);
  const sponsors = tracking.allSponsorStats();
  const alerts = tracking.computeDeadlineAlerts();
  const unread = stmts.unreadCountForUser.get(req.user.id).c;
  const notifications = stmts.listNotificationsForUser.all(req.user.id);
  res.json({
    today: todayStr(),
    month_name: monthName(year, month),
    stats,
    sponsors,
    alerts: alerts.map(a => ({ message: a.message, urgent: !!a.urgent, daily_missed: a.daily ? a.daily.missed : null })),
    unread,
    notifications
  });
});

app.get('/api/analytics', requireAuth, (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = Number(req.query.month) || (now.getMonth() + 1);
  res.json(tracking.analytics(year, month));
});

/* ============ CONTENTS ============ */

app.post('/api/contents', requireAuth, (req, res) => {
  const b = req.body || {};
  const date = parseDate(b.upload_date) || todayStr();
  const time = /^\d{2}:\d{2}$/.test(b.upload_time || '') ? b.upload_time : new Date().toTimeString().slice(0, 5);
  const slug = String(b.slug || '').trim();
  const headline = String(b.headline || '').trim();
  const category = normalizeCategory(b.category);
  if (!headline && !slug) return res.status(400).json({ error: 'Content headline or slug is required.' });

  let sponsor_id = null;
  if (b.sponsor_id) {
    const s = stmts.findSponsor.get(Number(b.sponsor_id));
    if (!s || s.deleted_at) return res.status(400).json({ error: 'Sponsor not found.' });
    sponsor_id = s.id;
  }

  const links = {};
  for (const p of PLATFORMS) links[p] = String(b[p] || '').trim();

  const slot_label = String(b.slot_label || '').trim().slice(0, 60);

  const info = stmts.createContent.run(
    date, time, req.user.id, slug, headline, category, sponsor_id,
    links.youtube, links.facebook, links.instagram, links.threads, links.x,
    links.tiktok, links.bluesky, links.reddit, links.pinterest, links.dailymotion,
    slot_label, nowIso()
  );
  const content = stmts.findContent.get(info.lastInsertRowid);
  const managers = stmts.listManagerUserIds.all();
  const today = todayStr();
  for (const m of managers) {
    if (m.id === req.user.id) continue;
    if (stmts.existsNotificationRefToday.get(m.id, 'upload', content.id, today + '%').c) continue;
    const title = content.headline || content.slug || 'New content';
    stmts.createNotification.run(m.id, sponsor_id || 0, `🎥 ${req.user.username} upload করেছে: ${title}`, 'upload', 'warn', content.id, nowIso());
  }

  maybeCompleteSponsor(sponsor_id);
  ensureSponsorDailyCompleteNotifications();
  bumpVersion('content');
  bumpVersion('sponsors');

  res.json({ ok: true, content });
});

app.get('/api/contents', requireAuth, (req, res) => {
  const rows = stmts.listContents.all().map(c => {
    const u = stmts.findUserById.get(c.uploaded_by);
    const sp = c.sponsor_id ? stmts.findSponsor.get(c.sponsor_id) : null;
    return {
      ...c,
      uploaded_by_name: (u || {}).username || '',
      uploaded_by_office: (u || {}).office_name || '',
      uploaded_by_designation: (u || {}).designation || '',
      sponsor_name: sp ? sp.name : '',
      sponsor_deleted: !!sp && !!sp.deleted_at
    };
  });
  res.json({ contents: rows });
});

app.get('/api/archive/export', requireAuth, (req, res) => {
  const q = req.query || {};
  const format = q.format === 'excel' || q.format === 'xls' ? 'excel' : 'pdf';
  const year = q.year === 'all' ? '' : String(q.year || '');
  const month = q.month === 'all' ? '' : String(q.month || '');
  const from = parseDate(q.from);
  const to = parseDate(q.to);
  const category = q.category === 'video' || q.category === 'static' ? q.category : 'all';
  let rows = stmts.listContents.all().map(c => {
    const u = stmts.findUserById.get(c.uploaded_by);
    const sp = c.sponsor_id ? stmts.findSponsor.get(c.sponsor_id) : null;
    return {
      ...c,
      uploaded_by_name: (u || {}).username || '',
      uploaded_by_office: (u || {}).office_name || '',
      sponsor_name: sp ? sp.name : ''
    };
  });
  rows = rows.filter(c => {
    const d = c.upload_date || '';
    if (!d) return false;
    if (year && d.slice(0, 4) !== year) return false;
    if (month && d.slice(5, 7) !== month) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (category !== 'all' && c.category !== category) return false;
    return true;
  });
  rows.sort((a, b) => (a.upload_date + ' ' + a.upload_time).localeCompare(b.upload_date + ' ' + b.upload_time));
  const bits = [];
  if (year) bits.push(month ? year + '-' + month : year);
  if (from || to) bits.push((from || '…') + ' → ' + (to || '…'));
  bits.push(category === 'all' ? 'All Categories' : category.toUpperCase());
  const subtitle = `Archive — ${rows.length} content(s)${bits.length ? ' [' + bits.join(' · ') + ']' : ''}`;
  if (format === 'excel') {
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="microboss-archive.xls"');
    return res.send(pdf.archiveExportExcel(rows, subtitle));
  }
  pdf.archiveExportPdf(rows, subtitle).then(buf => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="microboss-archive.pdf"');
    res.send(buf);
  }).catch(e => res.status(500).json({ error: e.message }));
});

app.get('/api/contents/:id', requireAuth, (req, res) => {
  const c = stmts.findContent.get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Content not found.' });
  const u = stmts.findUserById.get(c.uploaded_by);
  const sp = c.sponsor_id ? stmts.findSponsor.get(c.sponsor_id) : null;
  res.json({
    content: {
      ...c,
      uploaded_by_name: (u || {}).username || '',
      uploaded_by_office: (u || {}).office_name || '',
      uploaded_by_designation: (u || {}).designation || '',
      sponsor_name: sp ? sp.name : '',
      sponsor_deleted: !!sp && !!sp.deleted_at
    }
  });
});

app.delete('/api/contents/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c = stmts.findContent.get(id);
  if (!c) return res.status(404).json({ error: 'Content not found.' });
  const canDeleteOwn = c.uploaded_by === req.user.id;
  if (!canDeleteOwn && !access.canDeleteAnyContent(req.user)) {
    return res.status(403).json({ error: 'You can only delete your own uploads.' });
  }
  stmts.deleteContent.run(nowIso(), id);
  stmts.deleteUploadNotifications.run(id);
  revertIfNoLongerComplete(c.sponsor_id);
  const remark = String((req.body || {}).remark || '').trim();
  trashEntity('content', id, c.slug || c.headline, `📅 ${c.upload_date} · ${c.headline || c.slug}`, req.user.id, remark);
  bumpVersion('content');
  bumpVersion('sponsors');
  bumpVersion('trash');
  res.json({ ok: true });
});

app.put('/api/contents/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c = stmts.findContent.get(id);
  if (!c) return res.status(404).json({ error: 'Content not found.' });
  const isOwn = c.uploaded_by === req.user.id;
  if (!isOwn && !access.canEditAnyContent(req.user)) {
    return res.status(403).json({ error: 'You can only edit your own uploads.' });
  }
  const b = req.body || {};
  const date = parseDate(b.upload_date) || c.upload_date;
  const time = /^\d{2}:\d{2}$/.test(b.upload_time || '') ? b.upload_time : c.upload_time;
  const slug = String(b.slug ?? c.slug).trim();
  const headline = String(b.headline ?? c.headline).trim();
  const category = normalizeCategory(b.category ?? c.category);
  if (!headline && !slug) return res.status(400).json({ error: 'Content headline or slug is required.' });

  let sponsor_id = c.sponsor_id;
  if (b.sponsor_id !== undefined) {
    if (!b.sponsor_id) {
      sponsor_id = null;
    } else {
      const s = stmts.findSponsor.get(Number(b.sponsor_id));
      if (!s || s.deleted_at) return res.status(400).json({ error: 'Sponsor not found.' });
      sponsor_id = s.id;
    }
  }

  const links = {};
  for (const p of PLATFORMS) links[p] = b[p] !== undefined ? String(b[p]).trim() : (c[p] || '');

  const slot_label = b.slot_label !== undefined ? String(b.slot_label).trim().slice(0, 60) : c.slot_label;

  stmts.updateContent.run(
    date, time, slug, headline, category, sponsor_id,
    links.youtube, links.facebook, links.instagram, links.threads, links.x,
    links.tiktok, links.bluesky, links.reddit, links.pinterest, links.dailymotion,
    slot_label, id
  );
  revertIfNoLongerComplete(c.sponsor_id);
  maybeCompleteSponsor(sponsor_id);
  ensureSponsorDailyCompleteNotifications();
  bumpVersion('content');
  bumpVersion('sponsors');
  res.json({ ok: true, content: stmts.findContent.get(id) });
});

/* ============ SPONSORS ============ */

app.get('/api/sponsors', requireAuth, (req, res) => {
  res.json({ sponsors: tracking.allSponsorStats() });
});

app.post('/api/sponsors', requireManager, (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Sponsor/company name required.' });
  const content_type = String(b.content_type || '').trim();
  if (!content_type) return res.status(400).json({ error: 'Content type is required (e.g. National, International, Sports).' });
  const start = parseDate(b.start_date);
  const deadline = parseDate(b.deadline);
  if (!start) return res.status(400).json({ error: 'Contract start date is required.' });
  if (!deadline) return res.status(400).json({ error: 'Deadline is required.' });
  if (deadline < start) return res.status(400).json({ error: 'Deadline must be after start date.' });
  const total = Math.max(0, Number(b.total_videos) || 0);
  const daily = Math.max(0, Number(b.daily_target) || 0);
  if (total < 1) return res.status(400).json({ error: 'Total videos is required (min 1).' });
  if (daily < 1) return res.status(400).json({ error: 'Daily target is required (min 1).' });
  const info = stmts.createSponsor.run(
    name, String(b.note || '').trim(), content_type, start, deadline, total, daily,
    ['active', 'completed', 'paused', 'cancel'].includes(b.status) ? b.status : 'active',
    ['active', 'completed', 'paused', 'cancel'].includes(b.status) && b.status === 'completed' ? nowIso() : null,
    req.user.id, nowIso()
  );
  bumpVersion('sponsors');
  res.json({ ok: true, sponsor: tracking.sponsorStats(stmts.findSponsor.get(info.lastInsertRowid)) });
});

app.put('/api/sponsors/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const s = stmts.findSponsor.get(id);
  if (!s || s.deleted_at) return res.status(404).json({ error: 'Sponsor not found.' });
  const b = req.body || {};
  const name = String(b.name || s.name).trim();
  const content_type = String(b.content_type !== undefined ? b.content_type : s.content_type).trim();
  if (!content_type) return res.status(400).json({ error: 'Content type is required (e.g. National, International, Sports).' });
  const start = parseDate(b.start_date) || s.start_date;
  const deadline = parseDate(b.deadline) || s.deadline;
  if (!start) return res.status(400).json({ error: 'Contract start date is required.' });
  if (!deadline) return res.status(400).json({ error: 'Deadline is required.' });
  if (deadline < start) return res.status(400).json({ error: 'Deadline must be after start date.' });
  const totalVideos = b.total_videos !== undefined ? Math.max(0, Number(b.total_videos) || 0) : s.total_videos;
  const dailyTarget = b.daily_target !== undefined ? Math.max(0, Number(b.daily_target) || 0) : s.daily_target;
  if (totalVideos < 1) return res.status(400).json({ error: 'Total videos is required (min 1).' });
  if (dailyTarget < 1) return res.status(400).json({ error: 'Daily target is required (min 1).' });
  stmts.updateSponsor.run(
    name, b.note !== undefined ? String(b.note).trim() : s.note,
    content_type,
    start, deadline,
    totalVideos, dailyTarget,
    ['active', 'completed', 'paused', 'cancel'].includes(b.status) ? b.status : s.status,
    ['active', 'completed', 'paused', 'cancel'].includes(b.status) ? b.status : s.status,
    nowIso(),
    id
  );
  maybeCompleteSponsor(id);
  bumpVersion('sponsors');
  res.json({ ok: true, sponsor: tracking.sponsorStats(stmts.findSponsor.get(id)) });
});

app.delete('/api/sponsors/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const s = stmts.findSponsor.get(id);
  if (!s || s.deleted_at) return res.status(404).json({ error: 'Sponsor not found.' });
  stmts.deleteSponsor.run(nowIso(), id);
  trashEntity('sponsor', id, s.name, `${s.content_type || '—'} · ${s.status}`, req.user.id);
  bumpVersion('sponsors');
  bumpVersion('trash');
  res.json({ ok: true });
});

app.get('/api/sponsors/tracker', requireAuth, (req, res) => {
  const today = todayStr();
  const sponsors = tracking.allSponsorStats();
  const withDeadline = sponsors.filter(s => s.status === 'active' && s.deadline);
  const urgent = withDeadline.filter(s => s.deadline_.days_left !== null && s.deadline_.days_left <= 5 && s.deadline_.remaining > 0);
  res.json({ today, sponsors, urgent: urgent.map(s => s.name) });
});

/* ============ NOTIFICATIONS ============ */

function ensureBirthdayNotifications() {
  const now = new Date();
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = todayStr();
  const bdays = stmts.listBirthdaysToday.all(md);
  if (!bdays.length) return;
  const all = stmts.listAllUserIds.all();
  for (const bp of bdays) {
    for (const u of all) {
      if (u.id === bp.id) continue;
      const exists = stmts.existsBirthdayRefToday.get(u.id, bp.id, today).c;
      if (!exists) stmts.createNotification.run(u.id, 0, `🎂 আজ ${bp.username}-এর জন্মদিন! সবার পক্ষ থেকে শুভেচ্ছা।`, 'birthday', 'bday', bp.id, nowIso());
    }
  }
}

app.get('/api/notifications', requireAuth, (req, res) => {
  ensureBirthdayNotifications();
  ensureSponsorDailyCompleteNotifications();
  const list = stmts.listNotificationsForUser.all(req.user.id);
  const unread = stmts.unreadCountForUser.get(req.user.id).c;
  res.json({ notifications: list, unread });
});

app.post('/api/notifications/recheck', requireAuth, (req, res) => {
  ensureBirthdayNotifications();
  ensureSponsorDailyCompleteNotifications();
  const alerts = tracking.computeDeadlineAlerts();
  const unread = stmts.unreadCountForUser.get(req.user.id).c;
  res.json({ alerts: alerts.map(a => a.message), unread });
});

app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  stmts.markAllRead.run(req.user.id);
  res.json({ ok: true });
});

/* ============ LIVE ACTIVITY ============ */

app.get('/api/activity', requireAuth, (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const rows = stmts.listRecentContents.all(limit).map(c => {
    const u = stmts.findUserById.get(c.uploaded_by);
    const platforms = PLATFORMS.filter(p => (c[p] || '').trim() !== '');
    return {
      id: c.id,
      upload_date: c.upload_date,
      upload_time: c.upload_time,
      slug: c.slug,
      headline: c.headline,
      uploaded_by: c.uploaded_by,
      uploaded_by_name: (u || {}).username || 'Unknown',
      uploaded_by_designation: (u || {}).designation || '',
      created_at: c.created_at,
      platforms
    };
  });
  res.json({ items: rows, latest_id: rows.length ? rows[0].id : 0 });
});

/* ============ LIVE DELTA (cheap change-detection) ============ */

const versionFor = (key) => {
  const r = stmts.getVersion.get(key);
  return r ? Number(r.value) || 0 : 0;
};
function bumpVersion(area) {
  try { stmts.bumpVersion.run(area); } catch (e) {}
}

app.get('/api/delta', requireAuth, (req, res) => {
  const today = todayStr();
  const v = {
    content: versionFor('content'),
    sponsors: versionFor('sponsors'),
    programs: versionFor('programs'),
    notices: versionFor('notices'),
    captions: versionFor('captions'),
    users: versionFor('users'),
    trash: versionFor('trash'),
    checkin: versionFor('checkin'),
    ministers: versionFor('ministers'),
    parties: versionFor('parties')
  };
  res.json({ v, unread: stmts.unreadCountForUser.get(req.user.id).c, birthdays: stmts.listBirthdaysToday.all(today.slice(5)).length });
});

/* ============ NOTICES ============ */

app.get('/api/notices', requireAuth, (req, res) => {
  const active = stmts.listActiveNotices.all(nowIso()).map(n => ({ ...n, poster: stmts.findUserById.get(n.created_by) ? stmts.findUserById.get(n.created_by).username : n.poster_name }));
  res.json({ notices: active });
});

app.get('/api/notices/all', requireAuth, (req, res) => {
  res.json({ notices: stmts.listAllNotices.all() });
});

app.post('/api/notices', requireManager, (req, res) => {
  const b = req.body || {};
  const message = String(b.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Notice message is required.' });
  const days = Math.max(1, Math.min(365, Math.round(Number(b.days) || 7)));
  const created = nowIso();
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  const info = stmts.createNotice.run(
    message,
    String(b.poster_name || '').trim(),
    String(b.designation || '').trim(),
    String(b.department || '').trim(),
    String(b.phone || '').trim(),
    String(b.email || '').trim(),
    days, created, expires, req.user.id
  );
  const n = stmts.findNotice.get(info.lastInsertRowid);
  const all = stmts.listAllUserIds.all();
  const today = todayStr();
  for (const u of all) {
    if (stmts.existsNotificationRefToday.get(u.id, 'notice', n.id, today + '%').c) continue;
    stmts.createNotification.run(u.id, 0, `📢 নতুন নোটিশ: ${message}`, 'notice', 'notice', n.id, created);
  }
  bumpVersion('notices');
  res.json({ ok: true, notice: { ...n, poster: req.user.username } });
});

app.delete('/api/notices/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const n = stmts.findNotice.get(id);
  if (!n) return res.status(404).json({ error: 'Notice not found.' });
  if (n.created_by !== req.user.id && !auth.isManager(req.user)) {
    return res.status(403).json({ error: 'You can only delete notices you posted.' });
  }
  stmts.deleteNotice.run(nowIso(), id);
  trashEntity('notice', id, 'Notice', n.message, req.user.id);
  bumpVersion('notices');
  bumpVersion('trash');
  res.json({ ok: true });
});

/* ============ COMMON CAPTIONS ============ */

app.get('/api/captions', requireAuth, (req, res) => {
  const rows = stmts.listCaptions.all();
  const users = {};
  for (const c of rows) {
    if (!users[c.created_by]) users[c.created_by] = stmts.findUserById.get(c.created_by);
  }
  res.json({ captions: rows.map(c => ({ ...c, poster: users[c.created_by] ? users[c.created_by].username : 'Team' })) });
});

app.post('/api/captions', requireManager, (req, res) => {
  const b = req.body || {};
  const caption = String(b.caption || '').trim();
  if (!caption) return res.status(400).json({ error: 'Caption text is required.' });
  const category = String(b.category || '').trim() || 'General';
  const description = String(b.description || '').trim();
  const keywords = String(b.keywords || '').trim();
  const tags = String(b.tags || '').trim();
  const hashtag = String(b.hashtag || '').trim();
  const minister_name = String(b.minister_name || '').trim();
  const info = stmts.createCaption.run(category, caption, description, hashtag, keywords, tags, minister_name, nowIso(), req.user.id);
  const c = stmts.findCaption.get(info.lastInsertRowid);
  bumpVersion('captions');
  res.json({ ok: true, caption: { ...c, poster: req.user.username } });
});

app.put('/api/captions/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const c = stmts.findCaption.get(id);
  if (!c) return res.status(404).json({ error: 'Caption not found.' });
  const b = req.body || {};
  const caption = String(b.caption || '').trim();
  if (!caption) return res.status(400).json({ error: 'Caption text is required.' });
  const category = String(b.category || '').trim() || 'General';
  const description = String(b.description || '').trim();
  const keywords = String(b.keywords || '').trim();
  const tags = String(b.tags || '').trim();
  const hashtag = String(b.hashtag || '').trim();
  const minister_name = String(b.minister_name || '').trim();
  stmts.updateCaption.run(category, caption, description, hashtag, keywords, tags, minister_name, id);
  bumpVersion('captions');
  res.json({ ok: true, caption: stmts.findCaption.get(id) });
});

app.delete('/api/captions/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c = stmts.findCaption.get(id);
  if (!c) return res.status(404).json({ error: 'Caption not found.' });
  if (c.created_by !== req.user.id && !auth.isManager(req.user)) {
    return res.status(403).json({ error: 'You can only delete captions you added.' });
  }
  stmts.deleteCaption.run(id);
  bumpVersion('captions');
  res.json({ ok: true });
});

/* ============ MINISTERS ============ */

app.get('/api/ministers', requireAuth, (req, res) => {
  res.json({ ministers: stmts.listMinisters.all() });
});

app.put('/api/ministers/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const m = stmts.findMinisterById.get(id);
  if (!m) return res.status(404).json({ error: 'Minister not found.' });
  const b = req.body || {};
  const fb_link = String(b.fb_link || '').trim();
  stmts.setMinisterLink.run(fb_link, id);
  bumpVersion('ministers');
  res.json({ ok: true, minister: stmts.findMinisterById.get(id) });
});

/* ============ PARTY GROUPS ============ */

app.get('/api/parties', requireAuth, (req, res) => {
  const parties = stmts.listParties.all().map(p => ({ ...p, pages: stmts.listPartyPages.all(p.id) }));
  res.json({ parties });
});

app.post('/api/parties', requireManager, (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (!name) return res.status(400).json({ error: 'Party name is required.' });
  if (stmts.findPartyByName.get(name)) return res.status(400).json({ error: 'Party already exists.' });
  const info = stmts.createParty.run(name, nowIso());
  bumpVersion('parties');
  res.json({ ok: true, party: stmts.findPartyById.get(info.lastInsertRowid) });
});

app.put('/api/parties/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const p = stmts.findPartyById.get(id);
  if (!p) return res.status(404).json({ error: 'Party not found.' });
  const name = String((req.body || {}).name || '').trim();
  if (!name) return res.status(400).json({ error: 'Party name is required.' });
  stmts.updateParty.run(name, id);
  bumpVersion('parties');
  res.json({ ok: true, party: stmts.findPartyById.get(id) });
});

app.delete('/api/parties/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const p = stmts.findPartyById.get(id);
  if (!p) return res.status(404).json({ error: 'Party not found.' });
  stmts.deletePartyPages.run(id);
  stmts.deleteParty.run(id);
  bumpVersion('parties');
  res.json({ ok: true });
});

app.post('/api/parties/:id/pages', requireManager, (req, res) => {
  const party_id = Number(req.params.id);
  if (!stmts.findPartyById.get(party_id)) return res.status(404).json({ error: 'Party not found.' });
  const name = String((req.body || {}).name || '').trim();
  const url = String((req.body || {}).url || '').trim();
  if (!name || !url) return res.status(400).json({ error: 'Page name and URL are required.' });
  const info = stmts.createPartyPage.run(party_id, name, url, nowIso());
  bumpVersion('parties');
  res.json({ ok: true, page: stmts.findPartyPage.get(info.lastInsertRowid) });
});

app.put('/api/party-pages/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const pg = stmts.findPartyPage.get(id);
  if (!pg) return res.status(404).json({ error: 'Page not found.' });
  const name = String((req.body || {}).name || '').trim();
  const url = String((req.body || {}).url || '').trim();
  if (!name || !url) return res.status(400).json({ error: 'Page name and URL are required.' });
  stmts.updatePartyPage.run(name, url, id);
  bumpVersion('parties');
  res.json({ ok: true, page: stmts.findPartyPage.get(id) });
});

app.delete('/api/party-pages/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const pg = stmts.findPartyPage.get(id);
  if (!pg) return res.status(404).json({ error: 'Page not found.' });
  stmts.deletePartyPage.run(id);
  bumpVersion('parties');
  res.json({ ok: true });
});

/* ============ PROGRAMS ============ */

app.get('/api/programs', requireAuth, (req, res) => {
  res.json({ programs: stmts.listPrograms.all(), special: stmts.listSpecialPrograms.all() });
});

function parseSlotTime(t) {
  return /^\d{2}:\d{2}$/.test(String(t || '')) ? String(t) : null;
}

function progField(b, key) {
  return String(b[key] ?? '').trim();
}

function progPayload(b) {
  return [
    progField(b, 'prog_title'), progField(b, 'prog_desc'),
    progField(b, 'prog_keywords'), progField(b, 'prog_tags'),
    progField(b, 'clip_title'), progField(b, 'clip_desc'),
    progField(b, 'clip_keywords'), progField(b, 'clip_tags')
  ];
}

function progDuration(b, fallback) {
  if (b.duration === undefined) return fallback === undefined ? 0 : fallback;
  return Math.max(0, parseInt(b.duration, 10) || 0);
}

const PROG_WEEKDAYS = ['শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার'];

function slotLabel(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

function progWeekday(b, fallback) {
  const w = String(b.weekday ?? '').trim();
  return PROG_WEEKDAYS.includes(w) ? w : (fallback || '');
}

app.post('/api/programs', requireManager, (req, res) => {
  const b = req.body || {};
  const slot_time = parseSlotTime(b.slot_time);
  const title = String(b.title || '').trim();
  if (!slot_time) return res.status(400).json({ error: 'Please choose a valid time (HH:MM).' });
  if (!title) return res.status(400).json({ error: 'Program name is required.' });
  const weekday = progWeekday(b);
  if (!weekday) return res.status(400).json({ error: 'Please choose a valid day (বার).' });
  const dup = stmts.findProgramSlot.get(weekday, slot_time);
  if (dup) return res.status(400).json({ error: `"${dup.title}" ইতিমধ্যে ${weekday} ${slotLabel(dup.slot_time)}-এ আছে — একই দিনে একই সময়ে আরেকটি প্রোগ্রাম যোগ করা যাবে না।` });
  const date = '';
  const info = stmts.createProgram.run(slot_time, date, weekday, title, req.user.id, nowIso(), progDuration(b), ...progPayload(b));
  bumpVersion('programs');
  res.json({ ok: true, program: stmts.findProgram.get(info.lastInsertRowid) });
});

app.put('/api/programs/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const p = stmts.findProgram.get(id);
  if (!p) return res.status(404).json({ error: 'Program not found.' });
  const b = req.body || {};
  const slot_time = parseSlotTime(b.slot_time) || p.slot_time;
  const title = String(b.title ?? p.title).trim();
  if (!title) return res.status(400).json({ error: 'Program name is required.' });
  const weekday = progWeekday(b, p.weekday);
  if (!weekday) return res.status(400).json({ error: 'Please choose a valid day (বার).' });
  const dup = stmts.findProgramSlot.get(weekday, slot_time);
  if (dup && dup.id !== id) return res.status(400).json({ error: `"${dup.title}" ইতিমধ্যে ${weekday} ${slotLabel(dup.slot_time)}-এ আছে — একই দিনে একই সময়ে আরেকটি প্রোগ্রাম রাখা যাবে না।` });
  const date = '';
  const payload = progPayload(b);
  const merged = payload.map((v, i) => {
    const key = ['prog_title', 'prog_desc', 'prog_keywords', 'prog_tags', 'clip_title', 'clip_desc', 'clip_keywords', 'clip_tags'][i];
    return b[key] === undefined ? p[key] : v;
  });
  stmts.updateProgram.run(slot_time, date, weekday, title, progDuration(b, p.duration), ...merged, id);
  bumpVersion('programs');
  res.json({ ok: true, program: stmts.findProgram.get(id) });
});

app.delete('/api/programs/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const p = stmts.findProgram.get(id);
  if (!p) return res.status(404).json({ error: 'Program not found.' });
  stmts.deleteProgram.run(nowIso(), id);
  trashEntity('program', id, p.title, `⏰ ${p.slot_time}`, req.user.id);
  bumpVersion('programs');
  bumpVersion('trash');
  res.json({ ok: true });
});

/* ============ SPECIAL PROGRAMS ============ */

function parseDateRange(b, fallbackFrom, fallbackTo) {
  const from = parseDate(b.date_from) || fallbackFrom;
  const to = parseDate(b.date_to) || from || fallbackTo;
  return { from, to };
}

app.post('/api/programs/special', requireManager, (req, res) => {
  const b = req.body || {};
  const slot_time = parseSlotTime(b.slot_time);
  const title = String(b.title || '').trim();
  if (!slot_time) return res.status(400).json({ error: 'Please choose a valid time (HH:MM).' });
  if (!title) return res.status(400).json({ error: 'Special program name is required.' });
  const from = parseDate(b.date_from);
  if (!from) return res.status(400).json({ error: 'বিশেষ প্রোগ্রামের তারিখ (Date From) বাধ্যতামূলক।' });
  const to = parseDate(b.date_to) || from;
  if (to < from) return res.status(400).json({ error: 'End date must be on or after start date.' });
  const dup = stmts.findSpecialOverlap.get(slot_time, to, from);
  if (dup) return res.status(400).json({ error: `"${dup.title}" ইতিমধ্যে ${dup.date_from}${dup.date_to !== dup.date_from ? ' → ' + dup.date_to : ''} তারিখে ${slotLabel(dup.slot_time)}-এ আছে — ওভারল্যাপিং তারিখে একই সময়ে আরেকটি বিশেষ প্রোগ্রাম যোগ করা যাবে না।` });
  const info = stmts.createSpecialProgram.run(title, slot_time, from, to, progDuration(b), req.user.id, nowIso());
  bumpVersion('programs');
  res.json({ ok: true, special: stmts.findSpecialProgram.get(info.lastInsertRowid) });
});

app.put('/api/programs/special/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const s = stmts.findSpecialProgram.get(id);
  if (!s) return res.status(404).json({ error: 'Special program not found.' });
  const b = req.body || {};
  const slot_time = parseSlotTime(b.slot_time) || s.slot_time;
  const title = String(b.title ?? s.title).trim();
  if (!title) return res.status(400).json({ error: 'Special program name is required.' });
  let active = s.active;
  if (b.active !== undefined) {
    active = b.active === 1 || b.active === '1' || b.active === true || b.active === 'true' ? 1 : 0;
  }
  if (b.date_from !== undefined || b.date_to !== undefined || b.slot_time !== undefined || b.title !== undefined) {
    const { from, to } = parseDateRange(b, s.date_from, s.date_to);
    if (!from) return res.status(400).json({ error: 'বিশেষ প্রোগ্রামের তারিখ (Date From) বাধ্যতামূলক।' });
    if (to < from) return res.status(400).json({ error: 'End date must be on or after start date.' });
    const dup = stmts.findSpecialOverlap.get(slot_time, to, from);
    if (dup && dup.id !== id) return res.status(400).json({ error: `"${dup.title}" ইতিমধ্যে ${dup.date_from}${dup.date_to !== dup.date_from ? ' → ' + dup.date_to : ''} তারিখে ${slotLabel(dup.slot_time)}-এ আছে — ওভারল্যাপিং তারিখে একই সময়ে আরেকটি বিশেষ প্রোগ্রাম রাখা যাবে না।` });
    stmts.updateSpecialProgram.run(title, slot_time, from, to, progDuration(b, s.duration), id);
  } else {
    stmts.updateSpecialProgram.run(title, slot_time, s.date_from, s.date_to, progDuration(b, s.duration), id);
  }
  if (b.active !== undefined) stmts.setSpecialActive.run(active, id);
  bumpVersion('programs');
  res.json({ ok: true, special: stmts.findSpecialProgram.get(id) });
});

app.delete('/api/programs/special/:id', requireManager, (req, res) => {
  const id = Number(req.params.id);
  const s = stmts.findSpecialProgram.get(id);
  if (!s) return res.status(404).json({ error: 'Special program not found.' });
  stmts.deleteSpecialProgram.run(nowIso(), id);
  trashEntity('special', id, s.title, `🌟 ${s.date_from}${s.date_to !== s.date_from ? ' → ' + s.date_to : ''} · ⏰ ${s.slot_time}`, req.user.id);
  bumpVersion('programs');
  bumpVersion('trash');
  res.json({ ok: true });
});

/* ============ TRASH ============ */

app.get('/api/trash', requireAuth, (req, res) => {
  const items = stmts.listTrash.all().map(t => {
    let exists = false;
    if (t.entity === 'content') exists = !!stmts.findContentAny.get(t.entity_id);
    else if (t.entity === 'sponsor') exists = !!stmts.findSponsor.get(t.entity_id);
    else if (t.entity === 'notice') exists = !!stmts.findNoticeAny.get(t.entity_id);
    else if (t.entity === 'program') exists = !!stmts.findProgramAny.get(t.entity_id);
    else if (t.entity === 'special') exists = !!stmts.findSpecialProgramAny.get(t.entity_id);
    else if (t.entity === 'user') exists = !!stmts.findUserAny.get(t.entity_id);
    const del = t.deleted_by ? stmts.findUserAny.get(t.deleted_by) : null;
    return { ...t, exists, deletedByName: del ? del.username : '' };
  });
  res.json({ items });
});

app.post('/api/trash/restore/:id', requireAuth, (req, res) => {
  const t = stmts.findTrashById.get(Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Trash item not found.' });
  const r = restoreEntity(t);
  if (!r.ok) return res.status(400).json(r);
  bumpVersion('trash');
  bumpVersion(t.entity);
  res.json({ ok: true });
});

app.delete('/api/trash/clear', requireManager, (req, res) => {
  const items = stmts.listTrash.all();
  for (const t of items) purgeEntity(t);
  bumpVersion('trash');
  bumpVersion('content');
  bumpVersion('sponsors');
  bumpVersion('notices');
  bumpVersion('programs');
  bumpVersion('users');
  res.json({ ok: true, cleared: items.length });
});

/* ============ PDF ============ */

app.get('/api/pdf/sponsor/:id', requireAuth, async (req, res) => {
  try {
    const from = parseDate(req.query.from), to = parseDate(req.query.to);
    const buf = await pdf.sponsorPdf(Number(req.params.id), req.query.contents !== '0', from, to);
    const s = stmts.findSponsor.get(Number(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sponsor-${(s ? s.name : 'report').replace(/[^a-z0-9]+/gi, '-')}.pdf"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/pdf/all', requireAuth, async (req, res) => {
  try {
    const from = parseDate(req.query.from), to = parseDate(req.query.to);
    const buf = await pdf.allSponsorsPdf(from, to);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="microboss-all-sponsors.pdf"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function sendReport(req, res, pdfFn, csvFn, pdfName, csvName) {
  const format = req.query.format === 'csv' ? 'csv' : 'pdf';
  try {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${csvName}"`);
      return res.send(csvFn());
    }
    pdfFn().then(buf => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdfName}"`);
      res.send(buf);
    }).catch(e => res.status(500).json({ error: e.message }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

app.get('/api/report/sponsor/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const s = stmts.findSponsor.get(id);
  const base = (s ? s.name : 'sponsor').replace(/[^a-z0-9]+/gi, '-');
  const from = parseDate(req.query.from), to = parseDate(req.query.to);
  sendReport(
    req, res,
    () => pdf.sponsorReportPdf(id, from, to),
    () => pdf.sponsorReportCsv(id, from, to),
    `sponsor-report-${base}.pdf`,
    `sponsor-report-${base}.csv`
  );
});

app.get('/api/report/employee/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const u = stmts.findUserById.get(id);
  const base = (u ? u.username : 'employee').replace(/[^a-z0-9]+/gi, '-');
  const from = parseDate(req.query.from), to = parseDate(req.query.to);
  sendReport(
    req, res,
    () => pdf.employeeReportPdf(id, from, to),
    () => pdf.employeeReportCsv(id, from, to),
    `employee-report-${base}.pdf`,
    `employee-report-${base}.csv`
  );
});

app.get('/api/report/timing', requireAuth, (req, res) => {
  const now = new Date();
  let year = Number(req.query.year) || now.getFullYear();
  let month = Number(req.query.month) || (now.getMonth() + 1);
  if (month < 1) month = 1;
  if (month > 12) month = 12;
  if (year < 2000 || year > 2100) year = now.getFullYear();
  const from = parseDate(req.query.from), to = parseDate(req.query.to);
  const userId = Number(req.query.user_id) || 0;
  const u = userId ? stmts.findUserById.get(userId) : null;
  const base = (u ? u.username : 'all').replace(/[^a-z0-9]+/gi, '-');
  const mkey = (from && to) ? `${from}-to-${to}` : `${year}-${String(month).padStart(2, '0')}`;
  sendReport(
    req, res,
    () => pdf.timingReportPdf(year, month, userId || null, from, to),
    () => pdf.timingReportCsv(year, month, userId || null, from, to),
    `office-timing-${base}-${mkey}.pdf`,
    `office-timing-${base}-${mkey}.csv`
  );
});

app.get('/api/report/slot', requireAuth, (req, res) => {
  const slot = String(req.query.slot || '').trim();
  if (!/^(L|T):/.test(slot)) return res.status(400).json({ error: 'Invalid slot.' });
  const from = parseDate(req.query.from), to = parseDate(req.query.to);
  const base = slot.replace(/[^a-z0-9]+/gi, '-');
  const key = (from && to) ? `${from}-to-${to}` : 'all-time';
  sendReport(
    req, res,
    () => pdf.slotReportPdf(slot, from, to),
    () => pdf.slotReportCsv(slot, from, to),
    `slot-report-${base}-${key}.pdf`,
    `slot-report-${base}-${key}.csv`
  );
});

/* ============ APP ============ */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  backfillSponsorCompletions();
  console.log('==============================================');
  console.log('  MICROBOSS is running!');
  console.log(`  Open your browser at:  http://localhost:${PORT}`);
  console.log('  Data folder: ' + DATA_DIR);
  console.log('==============================================');
});
