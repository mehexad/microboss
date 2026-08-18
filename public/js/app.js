/* MICROBOSS - frontend app */
let state = { user: null, view: 'dashboard', year: 0, month: 0, programs: [], special: [], sponsors: [], contents: [], contentFilter: 'all', contentCategoryFilter: 'all', contentSlotFilter: 'all', contentSearchField: 'all', contentDateFilter: 'all', contentDateFrom: '', contentDateTo: '', contentDateSingle: '', contentMonth: 0, contentMonthYear: 0, searchTerm: '', contentsPage: 1, archiveMonth: 'all', archiveYear: '', archiveDateFrom: '', archiveDateTo: '', archiveCategory: 'all', sponsorSearch: '', sponsorStatusFilter: 'all', reportType: 'sponsor', reportSponsorId: 0, reportEmployeeId: 0, reportFormat: 'pdf', reportRange: 'all', reportRangeDate: '', reportRangeFrom: '', reportRangeTo: '', reportRangeYear: 0, reportMonth: 0, reportYear: 0, reportUserId: 0, reportSlot: '', reportSlotOptions: [], teamUsers: [], birthdays: [], designations: [], accessLabels: {}, rankingSort: 'all_time' };

let DESIGNATIONS = [];

function canManage() { return state.user && ['owner', 'manager'].includes(state.user.access); }
function canEditAny() { return state.user && ['owner', 'manager'].includes(state.user.access); }
function canDeleteAny() { return state.user && ['owner', 'manager', 'assistant'].includes(state.user.access); }

async function loadDesignations() {
  try {
    const d = await api('/api/designations');
    DESIGNATIONS = d.designations || [];
    state.accessLabels = d.labels || {};
    const sel = document.getElementById('regDesignation');
    if (sel && !sel.querySelector('option[value]:not([value=""])')) {
      sel.innerHTML = '<option value="">— Select your Designation —</option>' + DESIGNATIONS.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    }
  } catch (e) {}
}

function designationOptions(selected) {
  if (!DESIGNATIONS.length) return '';
  return DESIGNATIONS.map(x => `<option value="${esc(x)}" ${x === selected ? 'selected' : ''}>${esc(x)}</option>`).join('');
}

function openContents() { state.contentFilter = 'all'; state.contentDateFilter = 'all'; state.contentSlotFilter = 'all'; state.searchTerm = ''; state.contentsPage = 1; saveContentPrefs(); go('contents'); }
function setContentFilter(f) { state.contentFilter = f; state.contentDateFilter = 'all'; state.contentSlotFilter = 'all'; state.contentsPage = 1; saveContentPrefs(); go('contents'); }

function saveContentPrefs() {
  const prefs = {
    filter: state.contentFilter || 'all',
    category: state.contentCategoryFilter || 'all',
    slot: state.contentSlotFilter || 'all',
    field: state.contentSearchField || 'all',
    date: state.contentDateFilter || 'all',
    from: state.contentDateFrom || '',
    to: state.contentDateTo || '',
    single: state.contentDateSingle || '',
    month: state.contentMonth || 0,
    year: state.contentMonthYear || 0,
    q: state.searchTerm || ''
  };
  try { localStorage.setItem('mb_content_prefs', JSON.stringify(prefs)); } catch (e) {}
}

function loadContentPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('mb_content_prefs') || '{}');
    if (p.filter) state.contentFilter = p.filter;
    if (p.category) state.contentCategoryFilter = p.category;
    if (p.slot) state.contentSlotFilter = p.slot;
    if (p.field) state.contentSearchField = p.field;
    if (p.date) state.contentDateFilter = p.date;
    state.contentDateFrom = p.from || '';
    state.contentDateTo = p.to || '';
    state.contentDateSingle = p.single || '';
    state.contentMonth = Number(p.month) || 0;
    state.contentMonthYear = Number(p.year) || 0;
    state.searchTerm = p.q || '';
    if (state.contentDateFilter === 'month') {
      const now = new Date();
      if (!state.contentMonth) state.contentMonth = now.getMonth() + 1;
      if (!state.contentMonthYear) state.contentMonthYear = now.getFullYear();
    }
  } catch (e) {}
}

const PLATFORMS = [
  { key: 'youtube', icon: '▶️', label: 'YouTube', host: 'youtube.com' },
  { key: 'facebook', icon: '👥', label: 'Facebook', host: 'facebook.com' },
  { key: 'instagram', icon: '📸', label: 'Instagram', host: 'instagram.com' },
  { key: 'threads', icon: '🧵', label: 'Threads', host: 'threads.net' },
  { key: 'x', icon: '𝕏', label: 'X', host: 'x.com' },
  { key: 'tiktok', icon: '🎵', label: 'TikTok', host: 'tiktok.com' },
  { key: 'bluesky', icon: '🌤️', label: 'Bluesky', host: 'bluesky.social' },
  { key: 'reddit', icon: '👽', label: 'Reddit', host: 'reddit.com' },
  { key: 'pinterest', icon: '📌', label: 'Pinterest', host: 'pinterest.com' },
  { key: 'dailymotion', icon: '🎬', label: 'Dailymotion', host: 'dailymotion.com' }
];

const PLATFORM_HOSTS = {
  youtube: ['youtube.com', 'youtu.be'],
  facebook: ['facebook.com', 'fb.watch', 'fb.me', 'fb.com'],
  instagram: ['instagram.com'],
  threads: ['threads.net'],
  x: ['x.com', 'twitter.com'],
  tiktok: ['tiktok.com'],
  bluesky: ['bluesky.social'],
  reddit: ['reddit.com'],
  pinterest: ['pinterest.com', 'pin.it'],
  dailymotion: ['dailymotion.com', 'dai.ly']
};

function platformLinkError(value, p) {
  const val = String(value || '').trim();
  if (!val) return null;
  let h = '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(val) ? val : 'https://' + val);
    h = u.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return `"${p.label}" বক্সে সঠিক URL দিন (যেমন https://${p.host})`;
  }
  const aliases = PLATFORM_HOSTS[p.key] || [p.host];
  const ok = aliases.some(a => h === a || h.endsWith('.' + a));
  if (!ok) {
    return `"${p.label}" বক্সে শুধু ${p.label} এর ভিডিও লিংক দিন — এখানে ${p.label}-এ আপলোড করা লিংকটাই বসবে!`;
  }
  return null;
}

function validatePlatformLinks(getId) {
  for (const p of PLATFORMS) {
    const el = document.getElementById(getId(p.key));
    if (!el) continue;
    const err = platformLinkError(el.value, p);
    if (err) return { el, err };
  }
  return null;
}

function flagLinkError(res) {
  if (!res) return;
  shakeApp();
  res.el.classList.add('input-error');
  res.el.focus();
  toast(res.err, 'error');
  playSound('error');
  setTimeout(() => res.el.classList.remove('input-error'), 1000);
}

const CATEGORIES = [
  { key: 'video', icon: '🎬', label: 'VIDEO' },
  { key: 'static', icon: '🖼️', label: 'STATIC' }
];

function catInfo(k) {
  return CATEGORIES.find(x => x.key === k) || CATEGORIES[0];
}

function catTag(k) {
  const c = catInfo(k);
  const cls = c.key === 'static' ? 'tag-static' : 'tag-video';
  return `<span class="tag ${cls}" style="font-size:10px;">${c.icon} ${c.label}</span>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function nowSlot() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${d.getMinutes() < 30 ? '00' : '30'}`;
}

function slotOptions(selected) {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    for (const mm of ['00', '30']) {
      const v = `${hh}:${mm}`;
      const disp = `${(h % 12) || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
      opts.push(`<option value="${v}" ${v === selected ? 'selected' : ''}>${disp}</option>`);
    }
  }
  return opts.join('');
}

function fmtDate(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[Number(m) - 1]} ${Number(d)}, ${y}`;
}

async function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(url, { credentials: 'same-origin', ...opts, headers });
  if (res.status === 401 && !opts.skipAuthRedirect) { showAuth(); throw new Error('Not logged in'); }
  let data = {};
  try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, type = 'info') {
  const w = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  w.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

/* ================= AUTH ================= */

function showTab(tab) {
  document.getElementById('tabLoginBtn').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegisterBtn').classList.toggle('active', tab === 'register');
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  const form = tab === 'login' ? document.getElementById('loginForm') : document.getElementById('registerForm');
  form.classList.remove('tab-form');
  void form.offsetWidth;
  form.classList.add('tab-form');
  localStorage.setItem('mb-auth-tab', tab === 'login' ? 'login' : 'register');
}

function togglePw(id, btn) {
  const input = document.getElementById(id);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

function showAuth() {
  document.getElementById('authView').style.display = 'flex';
  document.getElementById('appView').style.display = 'none';
  updateFabs();
  fitBrandSub();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBrandSub);
}

function showApp() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('appView').style.display = 'flex';
  updateFabs();
}

async function doLogin() {
  clearAuthError('login');
  const identifier = document.getElementById('loginIdentifier').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ identifier, password }), skipAuthRedirect: true });
    state.user = data.user;
    initApp();
  } catch (e) {
    const msg = e.message === 'Invalid credentials.'
      ? '⚠️ ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন।'
      : (e.message || 'লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    showAuthError('login', msg);
    toast(msg, 'error');
    shakeField('loginPassword');
    shakeField('loginIdentifier');
  }
}

async function doRegister() {
  clearAuthError('register');
  const fields = [
    ['regUsername', 'Full Name'],
    ['regNickname', 'Nickname'],
    ['regOfficeId', 'Office ID'],
    ['regOfficeName', 'Office Name'],
    ['regDesignation', 'Designation'],
    ['regEmail', 'Email'],
    ['regPhone', 'Phone'],
    ['regWhatsapp', 'WhatsApp Number'],
    ['regFb', 'Facebook Profile Link'],
    ['regBirth', 'Birth Date'],
    ['regPassword', 'Password'],
    ['regConfirmPassword', 'Confirm Password']
  ];
  const missing = fields.filter(([id]) => !document.getElementById(id).value.trim()).map(([, label]) => label);
  if (missing.length > 0) {
    toast('Please fill in: ' + missing.join(', '), 'error');
    return;
  }
  const pw = document.getElementById('regPassword').value;
  const confirmPw = document.getElementById('regConfirmPassword').value;
  if (pw !== confirmPw) {
    const msg = '⚠️ PASSWORD আর CONFIRM PASSWORD একই নয়! দুটি ফিল্ডে একই পাসওয়ার্ড লিখুন।';
    showAuthError('register', msg);
    toast(msg, 'error');
    shakeField('regPassword');
    shakeField('regConfirmPassword');
    return;
  }
  const regPhoneVal = document.getElementById('regPhone').value.trim();
  const regWaVal = document.getElementById('regWhatsapp').value.trim();
  if (!/^\+\d{1,3}[- ]?\d{6,13}$/.test(regPhoneVal)) {
    toast('⚠️ ফোন নম্বর অবশ্যই দেশের কোডসহ লিখুন (যেমন: +8801712345678) — যেকোনো দেশের কোড হতে পারে।', 'error');
    return;
  }
  if (!/^\+\d{1,3}[- ]?\d{6,13}$/.test(regWaVal)) {
    toast('⚠️ WhatsApp নম্বরও অবশ্যই দেশের কোডসহ লিখুন (যেমন: +8801712345678) — যেকোনো দেশের কোড হতে পারে।', 'error');
    return;
  }
  const body = {
    username: document.getElementById('regUsername').value.trim(),
    nickname: document.getElementById('regNickname').value.trim(),
    office_id: document.getElementById('regOfficeId').value.trim(),
    office_name: document.getElementById('regOfficeName').value.trim(),
    designation: document.getElementById('regDesignation').value.trim(),
    email: document.getElementById('regEmail').value.trim(),
    phone: regPhoneVal,
    whatsapp: regWaVal,
    fb_link: document.getElementById('regFb').value.trim(),
    birth_date: document.getElementById('regBirth').value,
    password: document.getElementById('regPassword').value
  };
  try {
    const data = await api('/api/register', { method: 'POST', body: JSON.stringify(body) });
    if (data.pending) {
      toast(data.message || 'আপনার রেজিস্ট্রেশন জমা হয়েছে! Owner/Manager অনুমোদন দিলে লগইন করতে পারবেন।', 'success');
      showTab('login');
      return;
    }
    state.user = data.user;
    initApp();
  } catch (e) { toast(e.message, 'error'); }
}

function showAuthError(which, msg) {
  const el = document.getElementById(which === 'login' ? 'loginError' : 'regError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearAuthError(which) {
  const el = document.getElementById(which === 'login' ? 'loginError' : 'regError');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function clearLoginError() {
  ['loginIdentifier', 'loginPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('input-error');
  });
  clearAuthError('login');
}

function clearRegPwError() {
  ['regPassword', 'regConfirmPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('input-error');
  });
  clearAuthError('register');
}

function shakeField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('input-error');
  void el.offsetWidth;
  el.classList.add('input-error');
  el.addEventListener('animationend', () => el.classList.remove('input-error'), { once: true });
}

async function doLogout() {
  stopCheckinClock();
  stopHeaderCheckInClock();
  try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
  state.user = null;
  showAuth();
}

function doRefresh() {
  const ov = document.getElementById('loadingOverlay');
  if (ov) ov.classList.add('show');
  setTimeout(() => location.reload(), 2000);
}

function fitBrandSub() {
  const brands = document.querySelectorAll('.brand');
  if (!brands.length) return;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;white-space:nowrap;left:-9999px;top:-9999px;';
  document.body.appendChild(holder);

  const sizeOf = (size, style, text) => {
    const s = document.createElement('span');
    s.style.cssText = `font-family:${style.fontFamily};font-weight:${style.fontWeight};font-style:${style.fontStyle};font-size:${size}px;letter-spacing:${style.letterSpacing};text-transform:${style.textTransform};`;
    s.textContent = text;
    holder.appendChild(s);
    const w = s.offsetWidth;
    s.remove();
    return w;
  };

  brands.forEach(brand => {
    const word = brand.querySelector('.brand-word');
    const sub = brand.querySelector('.brand-sub');
    if (!word || !sub) return;
    const mainText = (word.textContent || '').replace(/TM$/, '').trim();
    const subText = (sub.textContent || '').trim();
    if (!mainText || !subText) return;
    const wcs = getComputedStyle(word);
    const scs = getComputedStyle(sub);

    const base = parseFloat(wcs.fontSize) || 46;
    const wMain = sizeOf(100, wcs, mainText);
    const wSub = sizeOf(100, scs, subText);
    if (!wSub || !wMain) return;

    let size = Math.max(8, base * (wMain / wSub));
    const wMainFinal = sizeOf(base, wcs, mainText);
    let wSubFinal = sizeOf(size, scs, subText);
    let guard = 0;
    while (wSubFinal > wMainFinal && guard < 5) {
      size = Math.max(8, size * (wMainFinal / wSubFinal) * 0.995);
      wSubFinal = sizeOf(size, scs, subText);
      guard++;
    }

    sub.style.fontSize = size + 'px';
  });

  holder.remove();
}

function slideNav(dir) {
  const nav = document.getElementById('sbNav');
  if (nav) nav.scrollBy({ top: dir * 260, behavior: 'smooth' });
}

function updateSbSlideButtons() {
  const nav = document.getElementById('sbNav');
  const up = document.getElementById('sbUpBtn');
  const down = document.getElementById('sbDownBtn');
  if (!nav || !up || !down) return;
  const max = nav.scrollHeight - nav.clientHeight;
  const atTop = nav.scrollTop <= 4;
  const atBottom = nav.scrollTop >= max - 4;
  up.style.opacity = atTop ? '0' : '1';
  up.style.pointerEvents = atTop ? 'none' : 'auto';
  down.style.opacity = atBottom ? '0' : '1';
  down.style.pointerEvents = atBottom ? 'none' : 'auto';
}

function toggleSidebar(collapsed) {
  const sb = document.getElementById('sidebar');
  const expand = document.getElementById('sbExpandBtn');
  if (sb) {
    sb.classList.toggle('collapsed', collapsed);
    if (collapsed && window.innerWidth < 861) sb.classList.remove('open');
  }
  if (expand) expand.style.display = collapsed ? 'flex' : 'none';
  localStorage.setItem('mb-sidebar-collapsed', collapsed ? '1' : '0');
  setTimeout(updateSbSlideButtons, 260);
}

function setupSidebar() {
  const nav = document.getElementById('sbNav');
  if (nav) {
    nav.addEventListener('scroll', updateSbSlideButtons);
    window.addEventListener('resize', updateSbSlideButtons);
  }
  if (window.innerWidth >= 861) {
    const saved = localStorage.getItem('mb-sidebar-collapsed') === '1';
    toggleSidebar(saved);
  } else {
    const expand = document.getElementById('sbExpandBtn');
    if (expand) expand.style.display = 'none';
  }
}

let APP_INIT_DONE = false;
let INTERVALS_STARTED = false;

async function initApp() {
  try {
    const me = await api('/api/me');
    state.user = me.user;
  } catch (e) { showAuth(); return; }
  if (!APP_INIT_DONE) {
    APP_INIT_DONE = true;
    showApp();
    fitBrandSub();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBrandSub);
    window.addEventListener('resize', fitBrandSub);
    setupSidebar();
    initFabDrag();
    initOutsideClose();
    window.addEventListener('resize', repositionOpenPanels);
  } else {
    showApp();
  }
  const myDisplay = state.user.nickname || state.user.username;
  document.getElementById('myName').textContent = myDisplay;
  document.getElementById('myRole').textContent = state.user.access === 'owner' ? 'OWNER' : (state.accessLabels[state.user.access] || String(state.user.access || '').toUpperCase());
  document.getElementById('myAvatar').textContent = (myDisplay[0] || '?').toUpperCase();
  document.getElementById('navTeam').style.display = 'flex';
  const d = new Date();
  state.year = d.getFullYear();
  state.month = d.getMonth() + 1;
  const saved = localStorage.getItem('mb-view');
  const valid = ['dashboard', 'checkin', 'ranking', 'upload', 'contents', 'archive', 'sponsors', 'programs', 'notices', 'captions', 'oneeye', 'reports', 'team', 'trash', 'settings'];
  let target = valid.includes(saved) ? saved : 'dashboard';
  loadContentPrefs();
  await fetchBirthdays();
  go(target);
  fireLoginCelebrations();
  refreshBell();
  loadAlerts();
  refreshHeaderCheckIn();
  startLiveActivity();
  startNoticesPoll();
  refreshLiveNow();
  try { lastDelta = await api('/api/delta'); } catch (e) {}
  if (!INTERVALS_STARTED) {
    INTERVALS_STARTED = true;
    setInterval(updateLiveNow, 30000);
    setInterval(refreshLiveNow, 5 * 60 * 1000);
    setInterval(loadNewsTicker, 5 * 60 * 1000);
    setInterval(refreshOneEye, 2 * 60 * 1000);
    setInterval(deltaTick, 6000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) deltaTick(); });
  }
  APP_INIT_DONE = 2;
}

function renderFor(view, vc) {
  if (view === 'dashboard') return renderDashboard(vc);
  else if (view === 'checkin') return renderCheckIn(vc);
  else if (view === 'ranking') return renderRanking(vc);
  else if (view === 'upload') return renderUpload(vc);
  else if (view === 'contents') return renderContents(vc);
  else if (view === 'archive') return renderArchive(vc);
  else if (view === 'notices') return renderNotices(vc);
  else if (view === 'captions') return renderCaptions(vc);
  else if (view === 'oneeye') return renderOneEye(vc);
  else if (view === 'programs') return renderPrograms(vc);
  else if (view === 'sponsors') return renderSponsors(vc);
  else if (view === 'reports') return renderReports(vc);
  else if (view === 'team') return renderTeam(vc);
  else if (view === 'trash') return renderTrash(vc);
  else if (view === 'settings') return renderSettings(vc);
  vc.innerHTML = `<div class="empty">⚠️ Unknown view: ${esc(view)}</div>`;
}

async function go(view) {
  state.view = view;
  localStorage.setItem('mb-view', view);
  document.body.classList.remove('live-updating');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.remove('open');
  const titles = { dashboard: 'Dashboard', checkin: 'Check In', ranking: 'Ranking', upload: 'Upload Content', contents: 'All Contents', archive: 'Archive', sponsors: 'Sponsors', programs: 'Program Schedule', notices: 'Notices', captions: 'LIVE TITLE', oneeye: 'Youtube Upload Track', reports: 'Reports', team: 'Team', trash: 'Trash', settings: 'Settings' };
  const pt = document.getElementById('pageTitle');
  if (pt) pt.textContent = titles[view] || view;
  const ps = document.getElementById('pageSub');
  if (ps) ps.textContent = view === 'dashboard'
    ? `Monthly tracking · ${state.month}/${state.year}`
    : '';
  const vc = document.getElementById('viewContainer');
  if (!vc) return;
  const prevH = vc.offsetHeight;
  if (prevH > 0) vc.style.minHeight = prevH + 'px';
  vc.classList.add('view-swap');
  try {
    await renderFor(view, vc);
  } catch (e) {
    console.error('render failed for', view, e);
    toast((e && e.message) || 'Something went wrong loading this page', 'error');
    vc.innerHTML = `<div class="empty">⚠️ এই ভিউ লোড করা যায়নি — ${esc((e && e.message) || 'অজানা ত্রুটি')}</div>`;
  }
  vc.classList.remove('view-swap');
  vc.classList.add('view-in');
  if (prevH > 0) setTimeout(() => { vc.style.minHeight = ''; }, 420);
  setTimeout(() => vc.classList.remove('view-in'), 480);
}

/* ================= DASHBOARD ================= */

async function renderDashboard(vc) {
  const data = await api(`/api/dashboard?year=${state.year}&month=${state.month}`);
  let a;
  try { a = await api(`/api/analytics?year=${state.year}&month=${state.month}`); } catch (e) { a = null; }
  const s = data.stats;
  const total = s.total, sponsored = s.sponsored, free = s.free;

  const prevBtn = `<button class="btn btn-ghost btn-sm" onclick="changeMonth(-1)">◀ Prev</button>`;
  const nextBtn = `<button class="btn btn-ghost btn-sm" onclick="changeMonth(1)">Next ▶</button>`;

  const newHtml = `
    ${newsTickerHtml()}
    ${greetingBannerHtml(data)}
    <div id="completionArea">${completionBannersHtml(data.sponsors)}</div>
    <div class="flex mb-14">
      ${prevBtn}
      <span class="tag tag-gold" style="font-size:14px;">${esc(data.month_name)}</span>
      ${nextBtn}
      <span class="spacer"></span>
      <button class="btn btn-gold btn-sm" onclick="openSponsorTracker()">📊 Sponsor Tracker</button>
    </div>
    <div id="noticeArea">${noticesBannersHtml(state.notices)}</div>
    ${birthdaysBannerHtml()}
    <div id="liveAnchor" style="display:none;"></div>
    ${livePanelHtml()}
    <div class="cards">
      <div class="stat-card" onclick="openContents()" title="View all uploads">
        <div class="stat-label">Total Uploads</div>
        <div class="stat-value plain">${total}</div>
        <div class="stat-note">${fmtDate(s.first)} → ${fmtDate(s.last)} · Click to view</div>
      </div>
      <div class="stat-card" onclick="setContentCategoryFilter('video')" title="View ONLY VIDEO posts">
        <div class="stat-label">🎬 VIDEO</div>
        <div class="stat-value video">${s.videos}</div>
        <div class="stat-note">${total ? Math.round(s.videos / total * 100) : 0}% of total · Click to view</div>
      </div>
      <div class="stat-card" onclick="setContentCategoryFilter('static')" title="View ONLY STATIC posts">
        <div class="stat-label">🖼️ STATIC</div>
        <div class="stat-value static">${s.statics}</div>
        <div class="stat-note">${total ? Math.round(s.statics / total * 100) : 0}% of total · Click to view</div>
      </div>
      <div class="stat-card" onclick="setContentFilter('sponsored')" title="View ONLY videos WITH sponsor">
        <div class="stat-label">With Sponsor</div>
        <div class="stat-value">${sponsored}</div>
        <div class="stat-note">${total ? Math.round(sponsored / total * 100) : 0}% of total · Click to view</div>
      </div>
      <div class="stat-card" onclick="setContentFilter('free')" title="View ONLY videos WITHOUT sponsor">
        <div class="stat-label">Without Sponsor</div>
        <div class="stat-value">${free}</div>
        <div class="stat-note">${total ? Math.round(free / total * 100) : 0}% of total · Click to view</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel" style="cursor:pointer;" onclick="go('team')" title="Open Team page">
        <h3>🏆 <span class="em">Team Top 5</span> — Most Uploads This Month <span class="small">›</span></h3>
        ${s.per_member.length === 0 ? '<div class="empty">No uploads this month yet.</div>' : `
        <ul class="leaderboard">
          ${s.per_member.slice(0, 5).map((m, i) => `
            <li onclick="go('team')" title="Open Team page">
              <div class="rank rank-${i + 1}">${i + 1}</div>
              <span class="lb-name">${esc(m.username)}</span>
              <span class="lb-count">${m.count}</span>
            </li>`).join('')}
        </ul>`}
      </div>
      <div class="panel" style="cursor:pointer;" onclick="go('sponsors')" title="Open Sponsors page">
        <h3>🤝 <span class="em">Active Sponsors</span> <span class="small">›</span></h3>
        ${data.sponsors.filter(x => x.status === 'active').length === 0 ? '<div class="empty">No active sponsors.</div>' : data.sponsors.filter(x => x.status === 'active').map(sp => `
          <div class="mb-14" style="cursor:pointer;" onclick="openSponsorDetail(${sp.id})" title="Click for full sponsor tracking">
            <div class="flex">
              <b>${esc(sp.name)}</b>
              <span class="spacer"></span>
              <span class="small">${sp.deadline_ && sp.deadline_.days_left !== null ? (sp.deadline_.days_left < 0 ? '⛔ overdue' : sp.deadline_.days_left + 'd left') : ''}</span>
            </div>
            <div class="small mb-14" style="margin-top:2px;">${sp.deadline_ ? `${sp.deadline_.done}/${sp.total_videos} done · ${sp.deadline_.remaining} remaining` : ''}</div>
            <div class="progress ${sp.deadline_ && sp.deadline_.days_left !== null && sp.deadline_.days_left <= 5 && sp.deadline_.remaining > 0 ? 'progress-red' : ''}">
              <div style="width:${sp.deadline_ ? sp.deadline_.percent_done : 0}%"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>
    ${a ? `
    <div class="grid-2">
      <div class="panel">
        <h3>📈 <span class="em">Daily Average Content</span> <span class="small">— ${esc(data.month_name)}</span></h3>
        <div class="analytics-big">
          <div class="big-num">${a.daily_average}</div>
          <div class="big-sub">content / day</div>
        </div>
        <div class="mini-stats">
          <div><b>${a.monthly}</b><span>total</span></div>
          <div><b>${a.today_count}</b><span>today</span></div>
          <div><b>${a.best_day ? a.best_day.count : 0}</b><span>best day</span></div>
        </div>
        <div class="cat-avg">
          <div class="cat-avg-box video"><span class="cat-avg-ic">🎬</span><b>${a.daily_average_video}</b><span>video / day</span><i>${a.videos} total</i></div>
          <div class="cat-avg-box static"><span class="cat-avg-ic">🖼️</span><b>${a.daily_average_static}</b><span>static / day</span><i>${a.statics} total</i></div>
        </div>
      </div>
      <div class="panel">
        <h3>📊 <span class="em">Platform Distribution</span> <span class="small">— ${esc(data.month_name)}</span></h3>
        ${platformBarsHtml(a.platform_distribution)}
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3>🗓️ <span class="em">Weekly Performance</span> <span class="small">— last 7 days</span></h3>
        <div class="best-note">🏆 Best day: <b>${esc(a.best_week_day.label)}</b> — ${a.best_week_day.count} upload${a.best_week_day.count === 1 ? '' : 's'}</div>
        ${weekBarsHtml(a.weekly_performance, a.best_week_day)}
      </div>
      <div class="panel">
        <h3>⏰ <span class="em">Hourly Publishing Activity</span> <span class="small">— today (${a.today_count})</span></h3>
        <div class="best-note">🔝 Peak slot: <b>${esc(a.best_hour.label)}</b> — ${a.best_hour.count} upload${a.best_hour.count === 1 ? '' : 's'}</div>
        ${hourBarsHtml(a.hourly_activity, a.best_hour)}
      </div>
    </div>` : ''}
    ${loadAlertsHtml(data.alerts)}
    ${appFooterHtml()}
  `;

  const cArea = vc.querySelector('#completionArea');
  const keepIds = new Set(completionBannerList(data.sponsors).map(s => s.id));
  const leaving = cArea ? Array.from(cArea.querySelectorAll('.completion-banner'))
    .filter(el => !keepIds.has(Number(el.dataset.celebrateId))) : [];
  if (leaving.length) {
    await new Promise(res => {
      let left = leaving.length;
      leaving.forEach(el => {
        el.classList.add('leaving');
        el.addEventListener('animationend', () => {
          el.remove();
          if (--left === 0) res();
        }, { once: true });
      });
    });
  }

  vc.innerHTML = newHtml;
  fireCompletionCelebration(data.sponsors);
  fireGreetingToasts(data);
  loadNewsTicker();
}

function platformBarsHtml(list) {
  if (!list || !list.length) return '<div class="empty">No platform links this month.</div>';
  const max = Math.max(...list.map(x => x.count));
  return `<div class="h-bars">${list.map(p => {
    const pl = PLATFORMS.find(x => x.key === p.key) || {};
    const pct = max ? Math.round(p.count / max * 100) : 0;
    return `
      <div class="h-bar-row">
        <span class="h-bar-lbl">${pl.icon || ''} ${pl.label || p.key}</span>
        <span class="h-bar-track"><span class="h-bar-fill" style="width:${pct}%"></span></span>
        <span class="h-bar-num">${p.count}</span>
      </div>`;
  }).join('')}</div>`;
}

function weekBarsHtml(days, best) {
  const max = Math.max(1, ...days.map(d => d.count));
  return `<div class="mini-chart">${days.map(d => `
    <div class="mc-bar${best && best.date === d.date ? ' best' : ''}" title="${esc(d.label)} (${fmtDate(d.date)}) — ${d.count} upload${d.count === 1 ? '' : 's'}">
      <span class="mc-val">${d.count || ''}</span>
      <span class="mc-fill" style="height:${Math.max(4, Math.round(d.count / max * 100))}%"></span>
      <span class="mc-lbl">${esc(d.label)}</span>
    </div>`).join('')}</div>`;
}

function hourBarsHtml(hours, best) {
  const max = Math.max(1, ...hours.map(h => h.count));
  return `<div class="mini-chart">${hours.map(h => `
    <div class="mc-bar${best && best.hour === h.hour ? ' best' : ''}" title="${esc(h.label)} — ${h.count} upload${h.count === 1 ? '' : 's'}">
      <span class="mc-val">${h.count || ''}</span>
      <span class="mc-fill" style="height:${Math.max(4, Math.round(h.count / max * 100))}%"></span>
      <span class="mc-lbl">${h.hour % 12 === 0 ? '12' : h.hour % 12}</span>
    </div>`).join('')}</div>`;
}

function isBirthdayToday(bd) {
  if (!bd || !/^\d{4}-\d{2}-\d{2}$/.test(bd)) return false;
  const now = new Date();
  return now.getMonth() + 1 === Number(bd.slice(5, 7)) && now.getDate() === Number(bd.slice(8, 10));
}

function completionCelebrated(s) {
  try { return localStorage.getItem('mb-celebrate-' + s.id) === String(s.completed_at); }
  catch (e) { return true; }
}

function markCompletionCelebrated(s) {
  try { localStorage.setItem('mb-celebrate-' + s.id, String(s.completed_at)); } catch (e) {}
}

function completionBannerList(sponsors) {
  const DAY = 86400000;
  const now = Date.now();
  return (sponsors || []).filter(s => {
    if (s.status !== 'completed' || !s.completed_at) return false;
    const t = Date.parse(String(s.completed_at));
    if (isNaN(t)) return false;
    return t >= now - 2 * DAY && t <= now + DAY;
  });
}

function completionTiming(s) {
  if (!s.deadline) return 'on-time';
  const cd = localYmd(s.completed_at);
  const dl = String(s.deadline);
  if (cd && dl && cd < dl) return 'early';
  if (cd && dl && cd > dl) return 'late';
  return 'on-time';
}

function completionBannerHtml(s) {
  const entering = !completionCelebrated(s);
  const timing = completionTiming(s);
  const cls = timing === 'early' ? 'cb-early' : timing === 'late' ? 'cb-late' : 'cb-ontime';
  const msg = timing === 'early'
    ? `'${esc(s.name)}' নির্ধারিত সময়ের আগেই সম্পন্ন হয়ে গেছে।`
    : timing === 'late'
      ? `'${esc(s.name)}'-এর কাজটি নির্ধারিত সময়ের মধ্যে সম্পন্ন না হলেও তা সফলভাবে শেষ হয়েছে।`
      : `'${esc(s.name)}' সফলভাবে তাদের লক্ষ্য অর্জন করেছে।`;
  return `
    <div class="completion-banner ${cls}${entering ? ' entering' : ''}" data-celebrate-id="${s.id}" onclick="openSponsorDetail(${s.id})" title="Sponsor details দেখুন">
      <div class="cb-inner">
        <div class="cb-ic">🏆</div>
        <div class="cb-msg">${msg}</div>
      </div>
    </div>`;
}

function completionBannersHtml(sponsors) {
  const list = completionBannerList(sponsors);
  if (list.length === 0) return '';
  return list.map(completionBannerHtml).join('');
}

function fireCompletionCelebration(sponsors) {
  const els = document.querySelectorAll('.completion-banner.entering');
  if (!els.length) return;
  els.forEach(el => {
    const s = (sponsors || []).find(x => x.id === Number(el.dataset.celebrateId));
    if (s) markCompletionCelebrated(s);
  });
  playSound('reward');
}

async function refreshCompletionBanners() {
  const area = document.getElementById('completionArea');
  if (!area || !state.user) return;
  let sponsors;
  try { sponsors = (await api('/api/sponsors')).sponsors; } catch (e) { return; }
  const banners = completionBannerList(sponsors);
  const shownIds = new Set(Array.from(area.querySelectorAll('.completion-banner')).map(el => Number(el.dataset.celebrateId)));
  const leaving = Array.from(area.querySelectorAll('.completion-banner')).filter(el => !banners.some(s => s.id === Number(el.dataset.celebrateId)));
  leaving.forEach(el => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => { if (el.parentNode) el.remove(); }, { once: true });
  });
  const fresh = banners.filter(s => !shownIds.has(s.id));
  if (fresh.length) {
    area.insertAdjacentHTML('beforeend', fresh.map(completionBannerHtml).join(''));
    fireCompletionCelebration(sponsors);
  }
}

const LIVE_REFRESH_VIEWS = new Set(['dashboard', 'checkin', 'ranking', 'contents', 'archive', 'notices', 'captions', 'oneeye', 'programs', 'sponsors', 'reports', 'team', 'trash']);

let liveRefreshing = false;

async function liveRefreshCurrentView() {
  if (!state.user || liveRefreshing || document.hidden) return;
  const view = state.view;
  if (!LIVE_REFRESH_VIEWS.has(view)) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) return;
  const vc = document.getElementById('viewContainer');
  if (!vc) return;
  if (vc.classList.contains('view-swap')) return;
  const minH = vc.offsetHeight;
  vc.style.minHeight = minH + 'px';
  const scrollY = window.scrollY;
  liveRefreshing = true;
  document.body.classList.add('live-updating');
  try {
    if (view === 'dashboard') await renderDashboard(vc);
    else if (view === 'checkin') await renderCheckIn(vc);
    else if (view === 'ranking') await renderRanking(vc);
    else if (view === 'contents') await renderContents(vc);
    else if (view === 'archive') await renderArchive(vc);
    else if (view === 'notices') await renderNotices(vc);
    else if (view === 'captions') await renderCaptions(vc);
    else if (view === 'oneeye') await renderOneEye(vc);
    else if (view === 'programs') await renderPrograms(vc);
    else if (view === 'sponsors') await renderSponsors(vc);
    else if (view === 'reports') await renderReports(vc);
    else if (view === 'team') await renderTeam(vc);
    else if (view === 'trash') await renderTrash(vc);
  } catch (e) {}
  window.scrollTo(0, scrollY);
  vc.style.minHeight = '';
  liveRefreshing = false;
}

let lastDelta = null;

async function deltaTick() {
  if (!state.user || document.hidden) return;
  let d;
  try { d = await api('/api/delta'); } catch (e) { return; }
  if (!lastDelta) { lastDelta = d; return; }
  const prev = lastDelta;
  lastDelta = d;
  const n = x => Number(x) || 0;
  const ch = {
    content: n(d.v.content) !== n(prev.v.content),
    sponsors: n(d.v.sponsors) !== n(prev.v.sponsors),
    programs: n(d.v.programs) !== n(prev.v.programs),
    notices: n(d.v.notices) !== n(prev.v.notices),
    captions: n(d.v.captions) !== n(prev.v.captions),
    users: n(d.v.users) !== n(prev.v.users),
    trash: n(d.v.trash) !== n(prev.v.trash),
    checkin: n(d.v.checkin) !== n(prev.v.checkin),
    ministers: n(d.v.ministers) !== n(prev.v.ministers),
    parties: n(d.v.parties) !== n(prev.v.parties),
    unread: n(d.unread) !== n(prev.unread),
    birthdays: n(d.birthdays) !== n(prev.birthdays)
  };
  if (ch.unread) refreshBell();
  if (ch.content) pollActivity();
  if (ch.notices) fetchNotices();
  if (ch.birthdays) fetchBirthdays();
  if (ch.checkin) refreshHeaderCheckIn();
  if (ch.sponsors) refreshSponsorUi();
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) return;
  const vc = document.getElementById('viewContainer');
  if (!vc || vc.classList.contains('view-swap')) return;
  const view = state.view;
  let need = false;
  if (view === 'dashboard') need = ch.content || ch.sponsors || ch.notices || ch.birthdays;
  else if (view === 'checkin') need = ch.checkin;
  else if (view === 'ranking') need = ch.content || ch.sponsors;
  else if (view === 'contents' || view === 'archive') need = ch.content;
  else if (view === 'notices') need = ch.notices;
  else if (view === 'captions') need = ch.captions || ch.ministers || ch.parties;
  else if (view === 'programs') need = ch.programs;
  else if (view === 'sponsors') need = ch.sponsors;
  else if (view === 'reports') need = ch.content || ch.sponsors;
  else if (view === 'team') need = ch.users;
  else if (view === 'trash') need = ch.trash;
  if (need) liveRefreshCurrentView();
}

function greetingBannerHtml(data) {
  const isCurrentMonth = state.month === new Date().getMonth() + 1 && state.year === new Date().getFullYear();
  const top1 = isCurrentMonth && data.stats.per_member.length > 0 && data.stats.per_member[0].user_id === state.user.id;
  const bday = isBirthdayToday(state.user.birth_date);
  if (bday) {
    return `<div class="greeting-banner bday">
      🎂 শুভ জন্মদিন, <b>${esc(state.user.username)}</b>! 🎉<br>
      <span class="small">আজকের দিনটা শুধুই আপনার — দারুণ কিছু করার দিন! 🎈</span>
    </div>`;
  }
  if (top1) {
    return `<div class="greeting-banner top1">
      🏆 অভিনন্দন, <b>${esc(state.user.username)}</b>! আপনি এই মাসের টপ কন্ট্রিবিউটর! 🎉<br>
      <span class="small">সেরা পারফরম্যান্সের জন্য শুভকামনা — এভাবেই এগিয়ে যান! ⭐</span>
    </div>`;
  }
  return '';
}

function top1GuardKey() {
  const now = new Date();
  return 'mb-top1-pop-' + now.getFullYear() + '-' + (now.getMonth() + 1);
}

function bdayPopupKey() {
  const now = new Date();
  return 'mb-bday-pop-' + state.user.id + '-' + now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0');
}

function showBirthdayPopup() {
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop celeb-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal bday-modal">
        <button class="close-x" style="position:absolute;top:12px;right:16px;" onclick="closeModal()">✕</button>
        <div style="text-align:center;padding:8px 6px;">
          <div class="bday-emoji">🎂</div>
          <h3 style="justify-content:center;margin-bottom:6px;font-size:22px;">শুভ জন্মদিন, <span style="color:#FF7BB3;">${esc(state.user.nickname || state.user.username)}</span>! 🎉</h3>
          <div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:8px;">আজকের দিনটা শুধুই আপনার! 🎈</div>
          <div class="small" style="color:var(--text-dim);margin-bottom:20px;">আজ আরও ভালো কিছু করার দিন — সেরা কাজগুলো আপনার জন্যই অপেক্ষা করছে। ✨</div>
          <button class="btn btn-gold" onclick="closeModal()">ধন্যবাদ! 💛</button>
        </div>
      </div>
    </div>`;
  playSound('birthday');
}

function showTopContributorPopup() {
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop celeb-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal top1-modal">
        <button class="close-x" style="position:absolute;top:12px;right:16px;" onclick="closeModal()">✕</button>
        <div style="text-align:center;padding:8px 6px;">
          <div style="font-size:54px;margin-bottom:6px;">🏆</div>
          <h3 style="justify-content:center;margin-bottom:6px;font-size:21px;">অভিনন্দন, <span style="color:var(--gold);">${esc(state.user.nickname || state.user.username)}</span>!</h3>
          <div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:8px;">আপনি এই মাসের টপ কন্ট্রিবিউটর! 🎉</div>
          <div class="small" style="color:var(--text-dim);margin-bottom:20px;">সেরা পারফরম্যান্সের জন্য শুভকামনা — এভাবেই এগিয়ে যান! ⭐</div>
          <button class="btn btn-gold" onclick="closeModal()">সুপার! 🚀</button>
        </div>
      </div>
    </div>`;
  playSound('reward');
}

async function fireLoginCelebrations() {
  if (isBirthdayToday(state.user.birth_date)) {
    const key = bdayPopupKey();
    if (localStorage.getItem(key) !== '1') {
      localStorage.setItem(key, '1');
      setTimeout(showBirthdayPopup, 700);
      playSound('birthday');
    }
  }
  const tKey = top1GuardKey();
  if (localStorage.getItem(tKey) === '1') return;
  try {
    const now = new Date();
    const data = await api(`/api/dashboard?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
    const pm = data.stats.per_member;
    if (pm.length > 0 && pm[0].user_id === state.user.id) {
      localStorage.setItem(tKey, '1');
      setTimeout(showTopContributorPopup, 1700);
    }
  } catch (e) {}
}

async function fetchBirthdays() {
  try {
    const d = await api('/api/birthdays');
    state.birthdays = d.birthdays || [];
    const isMine = state.birthdays.some(b => b.id === state.user.id);
    if (isMine) return;
    const others = state.birthdays.filter(b => b.id !== state.user.id);
    if (others.length && localStorage.getItem(birthdayNotifyKey()) !== '1') {
      localStorage.setItem(birthdayNotifyKey(), '1');
      const names = others.map(b => b.username).join(', ');
      setTimeout(() => { toast('🎂 আজ জন্মদিন: ' + names + ' — সবার পক্ষ থেকে শুভেচ্ছা! 🎉'); playSound('birthday'); }, 1000);
    }
  } catch (e) {}
}

function birthdayNotifyKey() {
  const now = new Date();
  return 'mb-bday-others-' + (state.user ? state.user.id : 0) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function birthdaysBannerHtml() {
  const others = (state.birthdays || []).filter(b => b.id !== state.user.id);
  if (!others.length) return '';
  const names = others.map(b => `${esc(b.username)}${b.designation ? ' (' + esc(b.designation) + ')' : ''}`).join(', ');
  return `<div class="birthday-banner">🎂 আজ জন্মদিন: <b>${names}</b> — সবার পক্ষ থেকে শুভেচ্ছা! 🎉</div>`;
}

function fireGreetingToasts(data) {
  const isCurrentMonth = state.month === new Date().getMonth() + 1 && state.year === new Date().getFullYear();
  const top1 = isCurrentMonth && data.stats.per_member.length > 0 && data.stats.per_member[0].user_id === state.user.id;
  if (!top1) return;
  const key = top1GuardKey();
  if (localStorage.getItem(key) === '1') return;
  localStorage.setItem(key, '1');
  setTimeout(showTopContributorPopup, 1400);
}

function changeMonth(delta) {
  let m = state.month + delta;
  let y = state.year;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  state.month = m; state.year = y;
  go('dashboard');
}

function loadAlertsHtml(alerts) {
  if (!alerts || alerts.length === 0) return '';
  return alerts.map(a => {
    const obj = typeof a === 'object' ? a : null;
    const msg = obj ? obj.message : a;
    let cls = 'warn', icon = '⚠️';
    if (obj) {
      if (obj.urgent || obj.daily_missed === true) { cls = 'urgent'; icon = '🚨'; }
      else if (obj.daily_missed === false) { cls = 'success'; icon = '✅'; }
    } else if (/URGENT|CROSSED/.test(a)) { cls = 'urgent'; icon = '🚨'; }
    return `
    <div class="alert-banner alert-${cls}">
      <span>${icon}</span> ${esc(msg)}
    </div>`;
  }).join('');
}

async function loadAlerts() {
  try {
    const data = await api('/api/dashboard');
    document.getElementById('alertsArea').innerHTML = loadAlertsHtml(data.alerts);
    const sig = (data.alerts || []).map(a => typeof a === 'string' ? a : a.message).join('|');
    if (sig && sig !== state.lastAlertsSig) {
      state.lastAlertsSig = sig;
      playSound('alert');
    }
  } catch (e) {}
}

/* ================= CHECK-IN / CHECK-OUT ================= */

let checkinClock = null;
let headerCheckinTimer = null;

function stopHeaderCheckInClock() {
  clearInterval(headerCheckinTimer);
  headerCheckinTimer = null;
}

function startHeaderCheckInClock() {
  stopHeaderCheckInClock();
  headerCheckinTimer = setInterval(renderHeaderCheckIn, 1000);
}

function renderHeaderCheckIn() {
  const el = document.getElementById('cinTop');
  if (!el) return;
  const d = state.checkin || { active: false };
  const btn = document.getElementById('cinTopBtn');
  const time = document.getElementById('cinTopTime');
  if (!btn || !time) return;
  if (d.active) {
    btn.textContent = '🚪 CHECK OUT';
    el.classList.add('in');
    const start = new Date(d.check_in_at);
    time.textContent = `In: ${fmtTime(d.check_in_at)} · ${isNaN(start) ? '--' : fmtDuration(Date.now() - start)}`;
    time.style.display = '';
  } else {
    btn.textContent = '✅ CHECK IN';
    el.classList.remove('in');
    time.textContent = '';
    time.style.display = 'none';
  }
}

async function refreshHeaderCheckIn() {
  try {
    const d = await api('/api/checkin');
    state.checkin = d;
  } catch (e) {
    state.checkin = { active: false, check_in_at: null, today: [] };
  }
  renderHeaderCheckIn();
  if (state.checkin.active) startHeaderCheckInClock(); else stopHeaderCheckInClock();
}

function headerCheckInToggle() {
  if (state.checkin && state.checkin.active) doCheckOut();
  else doCheckIn();
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtLocal(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function localYmd(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}h ${mm}m ${ss}s` : `${m}m ${ss}s`;
}

function stopCheckinClock() {
  clearInterval(checkinClock);
  checkinClock = null;
}

function startCheckinClock() {
  stopCheckinClock();
  checkinClock = setInterval(() => {
    const el = document.getElementById('checkinElapsed');
    if (!el) return;
    const start = new Date(state.checkin && state.checkin.check_in_at);
    if (isNaN(start)) return;
    el.textContent = fmtDuration(Date.now() - start);
  }, 1000);
}

function checkinStatusCardHtml(d) {
  if (d.active) {
    return `
      <div class="checkin-hero checkin-in">
        <div class="cin-big">✅ CHECKED IN</div>
        <div class="cin-time">Checked in at: <b>${fmtTime(d.check_in_at)}</b></div>
        <div class="cin-elapsed">Working time: <b id="checkinElapsed">${fmtDuration(Date.now() - new Date(d.check_in_at))}</b></div>
        <button class="btn btn-danger btn-lg" onclick="doCheckOut()">🚪 Check Out</button>
      </div>`;
  }
  return `
    <div class="checkin-hero checkin-out">
      <div class="cin-big">⏸️ NOT CHECKED IN</div>
      <div class="cin-sub">আপনি এখনো চেক-ইন করেননি। অফিসের কাজ শুরু করতে নিচের বাটনে চাপ দিন — সময় ট্র্যাক শুরু হবে।</div>
      <button class="btn btn-gold btn-lg" onclick="doCheckIn()">✅ Check In</button>
    </div>`;
}

async function renderCheckIn(vc) {
  const d = await api('/api/checkin');
  state.checkin = d;
  const mine = d.today.filter(r => r.user_id === state.user.id);
  const list = d.manager ? d.today : mine;
  const totalMs = list.reduce((n, r) => n + (r.duration_ms || 0), 0);
  vc.innerHTML = `
    <div class="panel">${checkinStatusCardHtml(d)}</div>
    <div class="panel">
      <h3>📋 <span class="em">Today's Check-In Records</span> <span class="tag tag-gold" style="font-size:11px;">${list.length} session${list.length === 1 ? '' : 's'}</span></h3>
      <p class="small mb-14">লগইন করার সময় অটোমেটিক চেক-ইন হয়। কাজ শেষে <b>Check Out</b> চাপুন — অথবা সরাসরি লগআউট করলেও অটো চেক-আউট হয়ে যাবে।</p>
      ${list.length === 0 ? '<div class="empty">আজকের কোনো চেক-ইন রেকর্ড নেই।</div>' : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th>${d.manager ? '<th>Member</th>' : ''}<th>Employee ID</th><th>Phone</th><th>Check In</th><th>Check Out</th><th>Duration</th><th></th></tr></thead>
          <tbody>
            ${list.map(r => {
              const dt = new Date(r.check_in_at);
              const dateTxt = isNaN(dt) ? '—' : dt.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
              return `
              <tr>
                <td class="nowrap">${dateTxt}</td>
                ${d.manager ? `<td><b>${esc(r.username)}</b></td>` : ''}
                <td class="nowrap">${esc(r.office_id || '—')}</td>
                <td class="nowrap">${esc(r.phone || '—')}</td>
                <td class="nowrap">${fmtTime(r.check_in_at)}</td>
                <td class="nowrap">${r.check_out_at ? fmtTime(r.check_out_at) : '<span class="tag tag-green">In</span>'}</td>
                <td class="mono">${fmtDuration(r.duration_ms)}</td>
                <td>${r.user_id === state.user.id ? `<button class="btn btn-danger btn-sm" onclick="deleteCheckInRecord(${r.id})" title="Delete my check-in record">🗑</button>` : ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="${d.manager ? 6 : 5}" style="text-align:right;font-weight:800;">Total today:</td>
            <td class="mono">${fmtDuration(totalMs)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>`}
    </div>`;
  if (d.active) startCheckinClock();
}

async function deleteCheckInRecord(id) {
  if (!confirm('নিশ্চিত? আপনার নিজের এই check-in রেকর্ডটি স্থায়ীভাবে মুছে যাবে।')) return;
  try {
    await api('/api/checkin/' + id, { method: 'DELETE' });
    toast('Check-in record deleted ✓', 'success');
    playSound('success');
    go('checkin');
  } catch (e) { toast(e.message, 'error'); }
}

async function doCheckIn() {
  try {
    const d = await api('/api/checkin', { method: 'POST' });
    await refreshHeaderCheckIn();
    toast(d.created ? 'Checked in ✓ — সময় ট্র্যাকিং শুরু হয়েছে' : 'আপনি ইতিমধ্যে চেক-ইন করা আছেন', 'success');
    playSound('success');
    if (state.view === 'checkin') go('checkin');
  } catch (e) { toast(e.message, 'error'); }
}

async function doCheckOut() {
  try {
    await api('/api/checkout', { method: 'POST' });
    await refreshHeaderCheckIn();
    stopCheckinClock();
    toast('Checked out ✓ — কাজ শেষে লগআউট করতে ভুলবেন না', 'success');
    playSound('success');
    if (state.view === 'checkin') go('checkin');
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= RANKING ================= */

function rankClass(i) {
  if (i === 1) return 'rank-1';
  if (i === 2) return 'rank-2';
  if (i === 3) return 'rank-3';
  return 'rank-n';
}

async function renderRanking(vc) {
  const d = await api(`/api/ranking?year=${state.year}&month=${state.month}`);
  const sortBy = state.rankingSort || 'all_time';
  const list = d.ranking.slice().sort((a, b) => b[sortBy] - a[sortBy]);
  const maxCount = Math.max(1, ...list.map(r => r[sortBy]));
  const totalAll = list.reduce((n, r) => n + r.all_time, 0);
  const totalMonth = list.reduce((n, r) => n + r.month, 0);
  vc.innerHTML = `
    <div class="panel">
      <div class="flex mb-14" style="align-items:center;">
        <h3 style="margin:0;">🏆 <span class="em">RANKING</span> <span class="small">— সর্বোচ্চ ইনপুট থেকে সর্বনিম্ন</span></h3>
        <span class="spacer"></span>
        <select class="input" style="width:auto;" onchange="setRankingSort(this.value)">
          <option value="all_time" ${sortBy === 'all_time' ? 'selected' : ''}>⏳ Sort: All Time</option>
          <option value="month" ${sortBy === 'month' ? 'selected' : ''}>📅 Sort: ${esc(d.month_name)}</option>
        </select>
      </div>
      <div class="archive-summary mb-14">
        <span class="tag tag-gold">${list.length} member${list.length === 1 ? '' : 's'}</span>
        <span class="tag tag-blue">${totalAll} total input${totalAll === 1 ? '' : 's'}</span>
        <span class="tag tag-green">${totalMonth} in ${esc(d.month_name)}</span>
      </div>
      ${list.length === 0 ? '<div class="empty">No members yet.</div>' : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Rank</th><th>Member</th><th>All Time</th><th>${esc(d.month_name)}</th><th>Today</th><th>🎬 Video</th><th>🖼️ Static</th></tr></thead>
          <tbody>
            ${list.map((r, i) => {
              const myRow = r.user_id === state.user.id;
              const pct = Math.round(r[sortBy] / maxCount * 100);
              return `
              <tr${myRow ? ' class="rank-my"' : ''}>
                <td><div class="rank ${rankClass(i + 1)}">${i + 1}</div></td>
                <td>
                  <div style="font-weight:700;">${esc(r.username)}${myRow ? ' <span class="tag tag-gold" style="font-size:9px;">YOU</span>' : ''}</div>
                  <div class="small">${esc([r.designation, r.office_name].filter(Boolean).join(' · ') || '—')}</div>
                  <div class="rank-bar"><span style="width:${pct}%"></span></div>
                </td>
                <td class="mono" style="font-weight:800;color:var(--gold);">${r.all_time}</td>
                <td class="mono">${r.month}</td>
                <td class="mono">${r.today}</td>
                <td class="mono">${r.videos}</td>
                <td class="mono">${r.statics}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>`;
}

function setRankingSort(v) {
  state.rankingSort = v;
  go('ranking');
}

/* ================= UPLOAD ================= */

async function renderUpload(vc) {
  let sponsors = [];
  try { sponsors = (await api('/api/sponsors')).sponsors; } catch (e) {}
  state.sponsors = sponsors;
  const active = sponsors.filter(x => x.status === 'active');

  let programs = [];
  let special = [];
  try { const d = await api('/api/programs'); programs = d.programs; special = d.special || []; } catch (e) {}
  state.programs = programs;
  state.special = special;
  const upDate = localStorage.getItem('mb_upload_date') || todayStr();

  vc.innerHTML = `
    <div class="panel">
      <div class="flex mb-14" style="align-items:center;">
        <h3 style="margin:0;">📤 <span class="em">Add Uploaded Content Links</span></h3>
        <span class="spacer"></span>
        <button class="btn btn-ghost" onclick="clearUploadForm()" title="Clear all input fields at once">🧹 Clear All</button>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;">
          <label>Upload Date <span id="upDateDay" class="tag tag-gold" style="font-size:10px;vertical-align:middle;display:none;"></span></label>
          <input class="input" type="date" id="upDate" value="${upDate}" onchange="refreshSlotPrograms(); updateUpDateDay(); saveUploadChoice()">
        </div>
        <div class="form-group" style="flex:1.6;">
          <label>SLOT <span class="small">(time &amp; program from schedule)</span></label>
          <select class="input" id="upTime" onchange="saveUploadChoice(); onSlotChange('upTime')">${buildSlotOptions(programs, upDate, '', '')}</select>
          <input class="input" id="upTimeCustom" type="text" placeholder="Type your own slot name…" style="display:none;margin-top:6px;">
        </div>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;">
          <label>Content Slug Name</label>
          <input class="input" id="upSlug" type="text" placeholder="e.g. travel-vlog-ep-12">
        </div>
        <div class="form-group" style="flex:1;">
          <label>Content Headline</label>
          <input class="input" id="upHeadline" type="text" placeholder="Video title / headline">
        </div>
      </div>
      <div class="form-group mb-14">
        <label>Content Type <span class="req">*</span></label>
        <select class="input" id="upCategory">
          <option value="">— Select Content Type —</option>
          ${CATEGORIES.map(c => `<option value="${c.key}">${c.icon} ${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;">
          <label>Sponsor <span class="small">(if any)</span></label>
          <select class="input" id="upSponsor">
            <option value="">— No Sponsor —</option>
            ${active.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;align-items:flex-end;">
          <button class="btn btn-gold" onclick="openSponsorTracker()">📊 Sponsor Tracker</button>
        </div>
      </div>
      <h3 style="font-size:14px;margin-bottom:12px;">🔗 Platform Links <span class="small">(paste the link of every platform where this content was posted)</span></h3>
      <div class="links-grid">
        ${PLATFORMS.map(p => `
          <div class="platform-field">
            <label>${p.icon} ${p.label}</label>
            <input class="input" id="up_${p.key}" type="url" placeholder="https://${p.host}">
          </div>`).join('')}
      </div>
      <div class="mt-20">
        <button class="btn btn-gold" onclick="saveContent()">💾 Save Content Links</button>
      </div>
    </div>
  `;
  refreshSlotPrograms();
  updateUpDateDay();
  restoreUploadSlot();
}

function updateUpDateDay() {
  const el = document.getElementById('upDateDay');
  const d = document.getElementById('upDate');
  if (!el || !d) return;
  const wd = weekdayName(d.value);
  el.textContent = wd;
  el.style.display = wd ? '' : 'none';
}

function saveUploadChoice() {
  const d = document.getElementById('upDate');
  const sel = document.getElementById('upTime');
  if (d) localStorage.setItem('mb_upload_date', d.value);
  if (sel) localStorage.setItem('mb_upload_slot', sel.value);
}

function restoreUploadSlot() {
  const sel = document.getElementById('upTime');
  const saved = localStorage.getItem('mb_upload_slot');
  if (sel && saved && [...sel.options].some(o => o.value === saved)) sel.value = saved;
}

function setUpCategory(key, btn) {
  document.querySelectorAll('.seg-btn[data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === key));
}

function shakeApp() {
  const app = document.getElementById('appView');
  if (!app) return;
  app.classList.remove('shake');
  void app.offsetWidth;
  app.classList.add('shake');
  setTimeout(() => app.classList.remove('shake'), 600);
}

const SLOT_MARKS = [
  { key: 'UNCUT-CLIP', icon: '✂️', label: 'UNCUT-CLIP' },
  { key: 'REELS-SHORTS', icon: '🎬', label: 'REELS-SHORTS' },
  { key: 'Digital Content', icon: '📱', label: 'Digital Content' },
  { key: 'Podcast', icon: '🎙️', label: 'Podcast' },
  { key: 'Podcast Clip', icon: '🎙️', label: 'Podcast Clip' },
  { key: 'Talkshow Clip', icon: '🎤', label: 'Talkshow Clip' },
  { key: 'Digital Live', icon: '🔴', label: 'Digital Live' },
  { key: 'Digital Talkshow', icon: '📺', label: 'Digital Talkshow' }
];

function onSlotChange(id) {
  const sel = document.getElementById(id);
  const cust = document.getElementById(id + 'Custom');
  if (!sel || !cust) return;
  if (sel.value === 'mark:__custom__') {
    cust.style.display = '';
    cust.focus();
  } else {
    cust.style.display = 'none';
  }
}

function resolveSlotValue(selId, customId) {
  const slotVal = document.getElementById(selId).value;
  if (slotVal.startsWith('time:')) return { upload_time: slotVal.slice(5), slot_label: '' };
  if (slotVal === 'mark:__custom__') {
    const custom = (document.getElementById(customId).value || '').trim();
    if (!custom) {
      shakeApp();
      toast('Slot এর নাম লিখো!', 'error');
      playSound('error');
      return null;
    }
    return { slot_label: custom, upload_time: '' };
  }
  if (slotVal.startsWith('mark:')) return { slot_label: slotVal.slice(5), upload_time: '' };
  return { upload_time: nowSlot(), slot_label: '' };
}

function buildSlotOptions(programs, date, selTime, selLabel) {
  const list = programsForDate(date);
  let opts = '';
  if (list.length) {
    opts += list.map(p => {
      const sel = !selLabel && p.slot_time === selTime;
      return `<option value="time:${p.slot_time}" ${sel ? 'selected' : ''}>${slotLabel(p.slot_time)} — ${esc(p.title)}</option>`;
    }).join('');
  } else {
    opts += '<option value="" disabled>No programs for this day</option>';
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      for (const mm of ['00', '30']) {
        const v = `${hh}:${mm}`;
        const disp = `${(h % 12) || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
        opts += `<option value="time:${v}" ${!selLabel && v === selTime ? 'selected' : ''}>${disp}</option>`;
      }
    }
  }
  opts += '<option value="" disabled>──────────────</option>';
  opts += SLOT_MARKS.map(m => `<option value="mark:${m.key}" ${selLabel === m.key ? 'selected' : ''}>${m.icon} ${m.label}</option>`).join('');
  if (selLabel && !SLOT_MARKS.some(m => m.key === selLabel)) {
    opts += `<option value="mark:${esc(selLabel)}" selected>✏️ ${esc(selLabel)}</option>`;
  }
  opts += '<option value="mark:__custom__">➕ Others (type your own)</option>';
  return opts;
}

function runningProgramTime(programs, date) {
  const list = programsForDate(date);
  if (!list.length) return null;
  const nw = nowSlot();
  const exact = list.find(p => p.slot_time === nw);
  if (exact) return nw;
  const next = list.find(p => p.slot_time > nw);
  return next ? next.slot_time : list[list.length - 1].slot_time;
}

function refreshSlotPrograms() {
  const sel = document.getElementById('upTime');
  if (!sel) return;
  const date = document.getElementById('upDate').value;
  sel.innerHTML = buildSlotOptions(state.programs || [], date, '', '');
  const running = runningProgramTime(state.programs || [], date);
  sel.value = running ? 'time:' + running : 'time:' + nowSlot();
  onSlotChange('upTime');
}

function refreshEditSlotPrograms() {
  const sel = document.getElementById('editTime');
  if (!sel) return;
  const date = document.getElementById('editDate').value;
  sel.innerHTML = buildSlotOptions(state.programs || [], date, '', '');
  onSlotChange('editTime');
}

function clearUploadForm() {
  localStorage.removeItem('mb_upload_date');
  localStorage.removeItem('mb_upload_slot');
  document.getElementById('upDate').value = todayStr();
  document.getElementById('upSlug').value = '';
  document.getElementById('upHeadline').value = '';
  document.getElementById('upCategory').value = '';
  document.getElementById('upSponsor').value = '';
  for (const p of PLATFORMS) document.getElementById('up_' + p.key).value = '';
  refreshSlotPrograms();
  updateUpDateDay();
  toast('All fields cleared ✓', 'info');
}

async function saveContent() {
  const category = document.getElementById('upCategory').value;
  if (!category) {
    shakeApp();
    toast('Content Type select করুন — VIDEO নাকি STATIC বাধ্যতামূলক!', 'error');
    playSound('error');
    return;
  }
  const linkCheck = validatePlatformLinks(k => 'up_' + k);
  if (linkCheck) { flagLinkError(linkCheck); return; }
  const body = {
    upload_date: document.getElementById('upDate').value,
    upload_time: nowSlot(),
    slug: document.getElementById('upSlug').value,
    headline: document.getElementById('upHeadline').value,
    category,
    sponsor_id: document.getElementById('upSponsor').value
  };
  const slotRes = resolveSlotValue('upTime', 'upTimeCustom');
  if (!slotRes) return;
  body.upload_time = slotRes.upload_time || nowSlot();
  if (slotRes.slot_label) body.slot_label = slotRes.slot_label;
  for (const p of PLATFORMS) body[p.key] = document.getElementById('up_' + p.key).value;
  try {
    await api('/api/contents', { method: 'POST', body: JSON.stringify(body) });
    toast('Content saved ✓', 'success');
    playSound('success');
    renderUpload(document.getElementById('viewContainer'));
    loadAlerts();
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= QUICK UPLOAD PLUGIN ================= */

function updateFabs() {
  const show = !!(state.user && document.getElementById('appView').style.display !== 'none');
  for (const id of ['quickUploadFab', 'sponsorTrackerFab']) {
    const fab = document.getElementById(id);
    if (fab) fab.style.display = show ? 'flex' : 'none';
  }
  if (!state.user) {
    closeQuickUploadPanel();
    closeSponsorPanel();
  }
}

function toggleQuickUpload() {
  if (fabDragged) return;
  if (!state.user) {
    showAuth();
    toast('লগ ইন করো আগে — তারপর দ্রুত আপলোড দিতে পারবে!', 'error');
    return;
  }
  const panel = document.getElementById('quickUploadPanel');
  const fab = document.getElementById('quickUploadFab');
  const open = panel.classList.toggle('open');
  fab.classList.toggle('open', open);
  if (open) {
    closeSponsorPanel();
    positionQuickPanel(panel, fab);
    populateQuickUpload();
  }
}

function closeQuickUploadPanel() {
  const panel = document.getElementById('quickUploadPanel');
  const fab = document.getElementById('quickUploadFab');
  if (panel) panel.classList.remove('open');
  if (fab) fab.classList.remove('open');
}

function closeSponsorPanel() {
  const panel = document.getElementById('sponsorPanel');
  const fab = document.getElementById('sponsorTrackerFab');
  if (panel) panel.classList.remove('open');
  if (fab) fab.classList.remove('open');
}

function toggleSponsorPanel() {
  if (fabDragged) return;
  if (!state.user) {
    showAuth();
    toast('লগ ইন করো আগে!', 'error');
    return;
  }
  const panel = document.getElementById('sponsorPanel');
  const fab = document.getElementById('sponsorTrackerFab');
  const open = panel.classList.toggle('open');
  fab.classList.toggle('open', open);
  if (open) {
    closeQuickUploadPanel();
    positionQuickPanel(panel, fab);
    loadSponsorPanel();
  }
}

async function loadSponsorPanel() {
  const body = document.getElementById('sponsorPanelBody');
  try {
    const data = await api('/api/sponsors/tracker');
    body.innerHTML = data.sponsors.length === 0
      ? '<div class="empty">No sponsors yet. (Add sponsors from the Sponsors page.)</div>'
      : data.sponsors.map(trackerItemHtml).join('');
  } catch (e) {
    body.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

async function populateQuickUpload() {
  let sponsors = [];
  try { sponsors = (await api('/api/sponsors')).sponsors.filter(x => x.status === 'active'); } catch (e) {}
  const sel = document.getElementById('quSponsor');
  sel.innerHTML = '<option value="">— No Sponsor —</option>' + sponsors.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  const wrap = document.getElementById('quLinks');
  wrap.innerHTML = PLATFORMS.map(p => `
    <div class="qu-link">
      <span class="qu-link-ic">${p.icon}</span>
      <input class="input" id="qu_${p.key}" type="url" placeholder="https://${p.host}">
    </div>`).join('');
  try { const d = await api('/api/programs'); state.programs = d.programs; state.special = d.special || []; } catch (e) {}
  const d = document.getElementById('quDate');
  d.value = localStorage.getItem('mb_upload_date') || todayStr();
  quUpDateDay();
  quRefreshSlot();
}

function quUpDateDay() {
  const el = document.getElementById('quDateDay');
  const d = document.getElementById('quDate');
  if (!el || !d) return;
  const wd = weekdayName(d.value);
  el.textContent = wd;
  el.style.display = wd ? '' : 'none';
}

function quRefreshSlot() {
  const d = document.getElementById('quDate');
  const sel = document.getElementById('quSlot');
  if (!d || !sel) return;
  sel.innerHTML = buildSlotOptions(state.programs || [], d.value, '', '');
  const running = runningProgramTime(state.programs || [], d.value);
  sel.value = running ? 'time:' + running : 'time:' + nowSlot();
  onSlotChange('quSlot');
}

async function quickSaveUpload() {
  if (!state.user) { showAuth(); toast('লগ ইন করো আগে!', 'error'); return; }
  const headline = document.getElementById('quHeadline').value.trim();
  if (!headline) {
    shakeApp();
    toast('Content title দিন!', 'error');
    playSound('error');
    return;
  }
  const linkCheck = validatePlatformLinks(k => 'qu_' + k);
  if (linkCheck) { flagLinkError(linkCheck); return; }
  const body = {
    upload_date: document.getElementById('quDate').value || todayStr(),
    upload_time: nowSlot(),
    headline,
    category: document.getElementById('quCategory').value
  };
  const slotRes = resolveSlotValue('quSlot', 'quSlotCustom');
  if (!slotRes) return;
  body.upload_time = slotRes.upload_time || nowSlot();
  if (slotRes.slot_label) body.slot_label = slotRes.slot_label;
  const sp = document.getElementById('quSponsor').value;
  if (sp) body.sponsor_id = sp;
  for (const p of PLATFORMS) body[p.key] = document.getElementById('qu_' + p.key).value.trim();
  try {
    await api('/api/contents', { method: 'POST', body: JSON.stringify(body) });
    toast('Content saved ✓', 'success');
    playSound('success');
    localStorage.setItem('mb_upload_date', body.upload_date);
    document.getElementById('quHeadline').value = '';
    document.getElementById('quCategory').value = 'video';
    document.getElementById('quSponsor').value = '';
    for (const p of PLATFORMS) document.getElementById('qu_' + p.key).value = '';
    loadAlerts();
    refreshSponsorUi();
    if (state.view === 'upload') renderUpload(document.getElementById('viewContainer'));
    else if (state.view === 'contents') renderContents(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= DRAGGABLE FAB STACK ================= */

let fabDragged = false;

function positionFab(fab, left, top) {
  const pad = 6, size = 62;
  const maxLeft = Math.max(pad, window.innerWidth - size);
  const maxTop = Math.max(pad, window.innerHeight - size);
  fab.style.left = Math.min(Math.max(pad, left), maxLeft) + 'px';
  fab.style.top = Math.min(Math.max(pad, top), maxTop) + 'px';
}

function saveFabPositions() {
  const pos = {};
  for (const id of ['quickUploadFab', 'sponsorTrackerFab']) {
    const fab = document.getElementById(id);
    if (!fab || fab.style.display === 'none') continue;
    const r = fab.getBoundingClientRect();
    pos[id] = { left: Math.round(r.left), top: Math.round(r.top) };
  }
  try { state.user.fab_pos = pos; } catch (e) {}
  fetch('/api/me/fab-pos', {
    method: 'PUT', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pos)
  }).catch(() => {});
}

function initFabDrag() {
  const stack = document.getElementById('fabStack');
  if (!stack) return;
  const serverPos = (state.user && state.user.fab_pos) || {};
  for (const fab of stack.querySelectorAll('.qu-fab')) {
    let saved = null;
    if (serverPos[fab.id]) saved = serverPos[fab.id];
    else try { saved = JSON.parse(localStorage.getItem('microboss_fab_pos_' + fab.id)); } catch (e) {}
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      positionFab(fab, saved.left, saved.top);
      try { localStorage.setItem('microboss_fab_pos_' + fab.id, JSON.stringify({ left: saved.left, top: saved.top })); } catch (err) {}
    }
    fab.addEventListener('pointerdown', (e) => {
      if (fab.classList.contains('open')) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const rect = fab.getBoundingClientRect();
      const startLeft = rect.left, startTop = rect.top;
      let moved = false;
      const move = (ev) => {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
        positionFab(fab, startLeft + dx, startTop + dy);
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (moved) {
          fabDragged = true;
          setTimeout(() => { fabDragged = false; }, 60);
          try { localStorage.setItem('microboss_fab_pos_' + fab.id, JSON.stringify({ left: fab.getBoundingClientRect().left, top: fab.getBoundingClientRect().top })); } catch (err) {}
          saveFabPositions();
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }
  setTimeout(saveFabPositions, 600);
}

function initOutsideClose() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.qu-panel') || e.target.closest('.qu-fab')) return;
    closeQuickUploadPanel();
    closeSponsorPanel();
    const sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('open') && !e.target.closest('#sidebar') && !e.target.closest('.hamburger')) {
      sb.classList.remove('open');
    }
  });
}

function positionQuickPanel(panel, fab) {
  const fr = fab.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const M = 8, G = 12;
  const pw = panel.offsetWidth || 340;
  const maxHCap = Math.round(0.7 * vh);

  const aboveRoom = fr.top - G - M;
  const belowRoom = vh - fr.bottom - G - M;

  let placeBelow = aboveRoom < 160 && belowRoom >= 160;
  let maxH = placeBelow ? belowRoom : aboveRoom;
  maxH = Math.round(Math.max(120, Math.min(maxH, maxHCap)));
  panel.style.maxHeight = maxH + 'px';

  let top;
  if (placeBelow) {
    top = fr.bottom + G;
    if (top + maxH > vh - M) top = Math.max(M, vh - M - maxH);
  } else {
    top = fr.top - G - maxH;
    if (top < M) top = M;
  }

  let left = fr.left;
  if (left + pw > vw - M) {
    const alt = fr.right - pw;
    left = alt >= M ? alt : Math.max(M, vw - pw - M);
  }
  if (left < M) left = M;
  if (left + pw > vw - M) left = Math.max(M, vw - pw - M);

  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
  panel.style.bottom = 'auto';
}

function repositionOpenPanels() {
  const q = document.getElementById('quickUploadPanel');
  const qf = document.getElementById('quickUploadFab');
  if (q && q.classList.contains('open') && qf) positionQuickPanel(q, qf);
  const s = document.getElementById('sponsorPanel');
  const sf = document.getElementById('sponsorTrackerFab');
  if (s && s.classList.contains('open') && sf) positionQuickPanel(s, sf);
}

async function openContentEditModal(id) {
  const c = state.contents.find(x => x.id === id);
  if (!c) return;
  let sponsors = [];
  try { sponsors = (await api('/api/sponsors')).sponsors; } catch (e) {}
  const active = sponsors.filter(x => x.status === 'active');
  let programs = state.programs;
  if (!programs) {
    try { programs = (await api('/api/programs')).programs; state.programs = programs; } catch (e) {}
    programs = programs || [];
  }
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal modal-wide">
        <h3>✏️ Edit Content <button class="close-x" onclick="closeModal()">✕</button></h3>
        <div class="flex mb-14">
          <div class="form-group" style="flex:1;"><label>Upload Date</label><input class="input" type="date" id="editDate" value="${esc(c.upload_date)}" onchange="refreshEditSlotPrograms()"></div>
          <div class="form-group" style="flex:1;"><label>SLOT</label><select class="input" id="editTime" onchange="onSlotChange('editTime')">${buildSlotOptions(programs, c.upload_date, c.upload_time || '', c.slot_label || '')}</select><input class="input" id="editTimeCustom" type="text" placeholder="Type your own slot name…" style="display:none;margin-top:6px;"></div>
        </div>
        <div class="flex mb-14">
          <div class="form-group" style="flex:1;"><label>Content Slug Name</label><input class="input" id="editSlug" value="${esc(c.slug)}"></div>
          <div class="form-group" style="flex:1;"><label>Content Headline</label><input class="input" id="editHeadline" value="${esc(c.headline)}"></div>
        </div>
        <div class="form-group mb-14">
          <label>Content Type</label>
          <div class="seg">
            ${CATEGORIES.map(ct => `
              <button type="button" class="seg-btn ${(c.category || 'video') === ct.key ? 'active' : ''}" data-cat="${ct.key}" onclick="setEditCategory('${ct.key}', this)">${ct.icon} ${ct.label}</button>`).join('')}
          </div>
        </div>
        <div class="form-group mb-14">
          <label>Sponsor <span class="small">(if any)</span></label>
          <select class="input" id="editSponsor">
            <option value="">— No Sponsor —</option>
            ${active.map(s => `<option value="${s.id}" ${s.id === c.sponsor_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <h3 style="font-size:14px;margin-bottom:12px;">🔗 Platform Links</h3>
        <div class="links-grid">
          ${PLATFORMS.map(p => `
            <div class="platform-field">
              <label>${p.icon} ${p.label}</label>
              <input class="input" id="edit_${p.key}" type="url" value="${esc(c[p.key] || '')}" placeholder="https://${p.host}">
            </div>`).join('')}
        </div>
        <div class="flex mt-14">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <span class="spacer"></span>
          <button class="btn btn-gold" onclick="saveContentEdit(${id})">💾 Save Changes</button>
        </div>
      </div>
    </div>`;
}

function setEditCategory(key, btn) {
  document.querySelectorAll('.seg-btn[data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === key));
}

async function saveContentEdit(id) {
  const linkCheck = validatePlatformLinks(k => 'edit_' + k);
  if (linkCheck) { flagLinkError(linkCheck); return; }
  const body = {
    upload_date: document.getElementById('editDate').value,
    upload_time: nowSlot(),
    slug: document.getElementById('editSlug').value,
    headline: document.getElementById('editHeadline').value,
    category: document.querySelector('.seg-btn[data-cat].active')?.dataset.cat || 'video',
    sponsor_id: document.getElementById('editSponsor').value || '',
    slot_label: ''
  };
  const slotRes = resolveSlotValue('editTime', 'editTimeCustom');
  if (!slotRes) return;
  body.upload_time = slotRes.upload_time || nowSlot();
  if (slotRes.slot_label) body.slot_label = slotRes.slot_label;
  for (const p of PLATFORMS) body[p.key] = document.getElementById('edit_' + p.key).value;
  try {
    await api('/api/contents/' + id, { method: 'PUT', body: JSON.stringify(body) });
    toast('Content updated ✓', 'success');
    playSound('success');
    closeModal();
    go('contents');
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= SPONSOR TRACKER POPUP ================= */

const SPONSOR_STOP_MSG = {
  completed: '✓ Sponsor সম্পন্ন — আর নতুন ভিডিও লাগবে না',
  paused: '⏸️ Sponsor pause করা আছে — আপাতত নতুন ভিডিও লাগবে না',
  cancel: '✖ Sponsor cancel করা আছে — আর নতুন ভিডিও লাগবে না'
};

function trackerItemHtml(sp) {
  const t = sp.today, d = sp.deadline_;
  const stopMsg = SPONSOR_STOP_MSG[sp.status];
  const urgent = !stopMsg && d && d.days_left !== null && d.days_left <= 5 && d.remaining > 0;
  return `
    <div class="tracker-item">
      <div class="t-head">
        <div class="t-name">${esc(sp.name)}</div>
        <div class="t-date">${sp.status.toUpperCase()}${d && d.days_left !== null ? ` · Deadline ${fmtDate(sp.deadline)} (${d.days_left < 0 ? 'overdue' : d.days_left + 'd left'})` : ''}</div>
      </div>
      <div class="t-cols">
        <div class="t-box">
          <div class="t-label">🎯 Today Target</div>
          <div class="t-val">${t.done}<small> / ${t.target}</small></div>
          <div class="progress mt-8"><div style="width:${t.target ? Math.min(100, t.done / t.target * 100) : 0}%"></div></div>
          <div class="small mt-8">${stopMsg || (t.target === 0 ? 'দৈনিক টার্গেট নির্ধারণ করা নেই' : (t.remaining === 0 ? '✓ আজকের টার্গেট পূরণ হয়েছে!' : `আজকের টার্গেট পূরণ করতে আর ${t.remaining}টি ভিডিও লাগবে`))}</div>
        </div>
        <div class="t-box">
          <div class="t-label">⏰ Deadline Progress</div>
          <div class="t-val ${stopMsg || d.remaining === 0 ? 'ok' : (d && d.days_left !== null && d.days_left <= 5 ? 'warn' : '')}">${d.done}<small> / ${sp.total_videos}</small></div>
          <div class="progress ${urgent ? 'progress-red' : ''} mt-8"><div style="width:${d.percent_done}%"></div></div>
          <div class="small mt-8">${stopMsg ? '—' : (d.remaining === 0 ? '✓ চুক্তি সম্পন্ন!' : `${d.remaining} বাকি · ${d.remaining_days > 0 ? `প্রতিদিন ~${d.need_per_day ?? '?'}টি লাগবে` : (d.remaining_days === 0 ? 'আজই ডেডলাইন!' : 'ডেডলাইন পেরিয়ে গেছে!')}`)}</div>
        </div>
      </div>
      ${urgent ? `<div class="urgent-banner">🚨 জরুরি — ডেডলাইনে মাত্র ${d.days_left} দিন বাকি, এখনও ${d.remaining}টি ভিডিও দরকার!</div>` : ''}
    </div>`;
}

function sponsorTrackerModalHtml(data) {
  const today = fmtDate(data.today);
  const sponsors = data.sponsors;
  return `
    <div class="modal">
      <h3>📊 Sponsor Tracker <span>${today}</span>
        <button class="close-x" onclick="closeModal()">✕</button>
      </h3>
      ${sponsors.length === 0 ? '<div class="empty">No sponsors yet. (Add sponsors from the Sponsors page.)</div>' : ''}
      ${sponsors.map(trackerItemHtml).join('')}
      <div class="flex">
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
        <span class="spacer"></span>
        <button class="btn btn-gold btn-sm" onclick="go('sponsors'); closeModal();">Manage Sponsors →</button>
      </div>
    </div>`;
}

async function openSponsorTracker() {
  let data;
  try { data = await api('/api/sponsors/tracker'); }
  catch (e) { toast((e && e.message) || 'Tracker load failed', 'error'); return; }
  document.getElementById('modalRoot').innerHTML = `<div class="modal-backdrop" data-role="sponsor-tracker" onclick="if(event.target===this)closeModal()">${sponsorTrackerModalHtml(data)}</div>`;
}

function sponsorDetailModalHtml(sp) {
  return `
    <div class="modal">
      <h3>📊 ${esc(sp.name)} <span class="small">Detail tracking</span>
        <button class="close-x" onclick="closeModal()">✕</button>
      </h3>
      <div class="flex mb-14">
        <span class="tag ${sp.status === 'active' ? 'tag-active' : sp.status === 'paused' ? 'tag-paused' : sp.status === 'cancel' ? 'tag-cancel' : 'tag-completed'}">${esc(sp.status)}</span>
        <span class="small">${fmtDate(sp.start_date)} → ${fmtDate(sp.deadline)}</span>
      </div>
      ${trackerItemHtml(sp)}
      ${sp.content_type ? `<div class="panel" style="margin-top:12px;"><h3 style="font-size:14px;">🎬 Content Type</h3>${esc(sp.content_type)}</div>` : ''}
      <div class="flex mt-14">
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" onclick="downloadPdf('/api/report/sponsor/${sp.id}?format=pdf')">📄 Report PDF</button>
        ${canManage() ? `<button class="btn btn-gold btn-sm" onclick="closeModal(); openSponsorForm(${sp.id})">✏️ Edit</button>` : ''}
      </div>
    </div>`;
}

async function openSponsorDetail(id) {
  let sponsors;
  try { sponsors = (await api('/api/sponsors')).sponsors; }
  catch (e) { toast((e && e.message) || 'Sponsor load failed', 'error'); return; }
  state.sponsors = sponsors;
  const sp = sponsors.find(x => x.id === id);
  if (!sp) return;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" data-role="sponsor-detail" data-id="${sp.id}" onclick="if(event.target===this)closeModal()">
      ${sponsorDetailModalHtml(sp)}
    </div>`;
}

async function refreshSponsorUi() {
  if (!state.user) return;
  const root = document.getElementById('modalRoot');
  if (root) {
    const tracker = root.querySelector('.modal-backdrop[data-role="sponsor-tracker"]');
    if (tracker) {
      let data;
      try { data = await api('/api/sponsors/tracker'); } catch (e) { return; }
      const modal = tracker.querySelector('.modal');
      if (modal) modal.outerHTML = sponsorTrackerModalHtml(data);
    }
    const detail = root.querySelector('.modal-backdrop[data-role="sponsor-detail"]');
    if (detail) {
      let sponsors;
      try { sponsors = (await api('/api/sponsors')).sponsors; } catch (e) { return; }
      const sp = sponsors.find(x => x.id === Number(detail.dataset.id));
      if (!sp) return;
      state.sponsors = sponsors;
      const modal = detail.querySelector('.modal');
      if (modal) modal.outerHTML = sponsorDetailModalHtml(sp);
    }
  }
  const panel = document.getElementById('sponsorPanel');
  if (panel && panel.classList.contains('open')) await loadSponsorPanel();
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

/* ================= CONTENTS LIST ================= */

async function renderContents(vc) {
  const data = await api('/api/contents');
  state.contents = data.contents;
  let rows = data.contents;
  let filterNote = '';
  if (state.contentFilter === 'sponsored') {
    rows = rows.filter(c => c.sponsor_name);
    filterNote = 'Showing ONLY videos <b>WITH</b> sponsor.';
  } else if (state.contentFilter === 'free') {
    rows = rows.filter(c => !c.sponsor_name);
    filterNote = 'Showing ONLY videos <b>WITHOUT</b> sponsor.';
  }
  if (state.contentCategoryFilter !== 'all') {
    rows = rows.filter(c => (c.category || 'video') === state.contentCategoryFilter);
  }
  const slotKeys = contentSlotOptions(data.contents);
  if (state.contentSlotFilter !== 'all' && slotKeys.includes(state.contentSlotFilter)) {
    rows = rows.filter(c => contentSlotKey(c) === state.contentSlotFilter);
  }
  const dateFilter = contentDateRange();
  if (dateFilter) {
    rows = rows.filter(c => (!dateFilter.from || c.upload_date >= dateFilter.from) && (!dateFilter.to || c.upload_date <= dateFilter.to));
  }
  const dateNote = contentDateFilterLabel();
  if (state.searchTerm) {
    const q = state.searchTerm.toLowerCase();
    const f = state.contentSearchField || 'all';
    rows = rows.filter(c => contentSearchText(c, f).toLowerCase().includes(q));
  }
  const PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(state.contentsPage || 1, totalPages);
  state.contentsPage = page;
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  vc.innerHTML = `
    <div class="panel">
      <div class="flex mb-14" style="align-items:center; gap:10px;">
        <h3 style="margin:0;">🗂️ <span class="em">All Uploaded Contents</span> <span class="small">(${rows.length})</span></h3>
        <span class="spacer"></span>
        <button class="btn btn-gold btn-sm" onclick="go('upload')">+ Add New</button>
      </div>
      ${filterNote ? `
      <div class="alert-banner alert-info mb-14">
        ${filterNote}
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" onclick="openContents()">✕ Clear filter</button>
      </div>` : ''}
      <div class="flex mb-14" style="flex-wrap:wrap; gap:10px;">
        <input class="input" id="contentSearch" placeholder="${SEARCH_PLACEHOLDERS[state.contentSearchField] || SEARCH_PLACEHOLDERS.all}" style="max-width:380px;" value="${esc(state.searchTerm || '')}" oninput="filterContentTable()">
        <select class="input" style="width:auto;" onchange="setContentSearchField(this.value)" title="Which column to search in">
          <option value="all" ${(state.contentSearchField || 'all') === 'all' ? 'selected' : ''}>🔍 All Fields</option>
          <option value="date" ${state.contentSearchField === 'date' ? 'selected' : ''}>📅 Date</option>
          <option value="slot" ${state.contentSearchField === 'slot' ? 'selected' : ''}>🕐 Slot</option>
          <option value="type" ${state.contentSearchField === 'type' ? 'selected' : ''}>🎬 Type</option>
          <option value="member" ${state.contentSearchField === 'member' ? 'selected' : ''}>👤 Uploaded By</option>
          <option value="headline" ${state.contentSearchField === 'headline' ? 'selected' : ''}>✏️ Slug / Headline</option>
          <option value="sponsor" ${state.contentSearchField === 'sponsor' ? 'selected' : ''}>🏷️ Sponsor</option>
        </select>
        <select class="input" style="width:auto;" onchange="setContentDateFilter(this.value)">
          <option value="all" ${state.contentDateFilter === 'all' ? 'selected' : ''}>All Time</option>
          <option value="week" ${state.contentDateFilter === 'week' ? 'selected' : ''}>Last 1 Week</option>
          <option value="1m" ${state.contentDateFilter === '1m' ? 'selected' : ''}>Last 1 Month</option>
          <option value="2m" ${state.contentDateFilter === '2m' ? 'selected' : ''}>Last 2 Months</option>
          <option value="3m" ${state.contentDateFilter === '3m' ? 'selected' : ''}>Last 3 Months</option>
          <option value="6m" ${state.contentDateFilter === '6m' ? 'selected' : ''}>Last 6 Months</option>
          <option value="1y" ${state.contentDateFilter === '1y' ? 'selected' : ''}>Last 1 Year</option>
          <option value="custom" ${state.contentDateFilter === 'custom' ? 'selected' : ''}>Custom Date Range</option>
          <option value="date" ${state.contentDateFilter === 'date' ? 'selected' : ''}>Specific Date</option>
          <option value="month" ${state.contentDateFilter === 'month' ? 'selected' : ''}>Custom Month</option>
        </select>
        <select class="input" style="width:auto;" onchange="setContentCategoryFilter(this.value)">
          <option value="all" ${state.contentCategoryFilter === 'all' ? 'selected' : ''}>🎞️ All Types</option>
          <option value="video" ${state.contentCategoryFilter === 'video' ? 'selected' : ''}>🎬 Video</option>
          <option value="static" ${state.contentCategoryFilter === 'static' ? 'selected' : ''}>🖼️ Static</option>
        </select>
        <select class="input" style="width:auto;" onchange="setContentSlotFilter(this.value)" title="Search by slot (time or marked slot)">
          <option value="all" ${state.contentSlotFilter === 'all' ? 'selected' : ''}>🕐 All Slots</option>
          ${slotKeys.map(k => `<option value="${esc(k)}" ${state.contentSlotFilter === k ? 'selected' : ''}>${esc(contentSlotLabel(k))}</option>`).join('')}
        </select>
        ${state.contentDateFilter === 'custom' ? `
          <input type="date" class="input" style="width:auto;" value="${esc(state.contentDateFrom)}" onchange="setContentDateFrom(this.value)" title="From date">
          <span class="small">→</span>
          <input type="date" class="input" style="width:auto;" value="${esc(state.contentDateTo)}" onchange="setContentDateTo(this.value)" title="To date">
        ` : ''}
        ${state.contentDateFilter === 'date' ? `
          <input type="date" class="input" style="width:auto;" value="${esc(state.contentDateSingle)}" onchange="setContentDateSingle(this.value)" title="Pick a date — only that day's content will show">
        ` : ''}
        ${state.contentDateFilter === 'month' ? `
          <select class="input" style="width:auto;" onchange="setContentMonth(this.value)">
            ${MONTH_SHORT.map((m, i) => `<option value="${i + 1}" ${state.contentMonth === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <select class="input" style="width:auto;" onchange="setContentMonthYear(this.value)">
            ${contentYearOptions().map(y => `<option value="${y}" ${state.contentMonthYear === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        ` : ''}
        ${dateNote ? `<span class="tag tag-gold" style="font-size:12px;">${dateNote}</span>` : ''}
      </div>
      ${rows.length === 0 ? '<div class="empty">No contents match this filter.</div>' : `
      <div class="table-wrap">
        <table id="contentTable">
          <thead>
            <tr>
              <th>Date</th><th>Slot</th><th>Type</th><th>Uploaded By</th><th>Slug / Headline</th>
              <th>Sponsor</th><th>Links</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.map(c => `
              <tr data-search="${esc(contentSearchText(c, 'all').toLowerCase())}">
                <td>${fmtDate(c.upload_date)}</td>
                <td>${slotTag(c)}</td>
                <td>${catTag(c.category)}</td>
                <td><b>${esc(c.uploaded_by_name)}</b></td>
                <td>
                  <div class="content-headline" onclick="openContentDetail(${c.id})" title="Click for details">${esc(c.headline || '—')}</div>
                  <div class="small mono">${esc(c.slug || '')}</div>
                </td>
                <td>${c.sponsor_name
                  ? `<span class="tag ${c.sponsor_deleted ? 'tag-deleted' : 'tag-gold'}"${c.sponsor_deleted ? ' title="Sponsor deleted"' : ''}>${esc(c.sponsor_name)}${c.sponsor_deleted ? ' (deleted)' : ''}</span>`
                  : '<span class="tag tag-gray">None</span>'}</td>
                <td>
                  ${PLATFORMS.filter(p => c[p.key] && c[p.key].trim()).map(p => `<span class="link-cell"><a class="link-pill" href="${esc(c[p.key])}" target="_blank" rel="noopener">${p.icon} ${p.label}</a><button class="copy-btn" title="Copy ${p.label} link" data-copy="${esc(c[p.key])}" onclick="event.stopPropagation(); copyFrom(this)">📋</button></span>`).join(' ') || '<span class="small">—</span>'}
                </td>
                <td>
                  ${(c.uploaded_by === state.user.id || canEditAny()) ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openContentEditModal(${c.id})" title="Edit">✏️</button>` : ''}
                  ${(c.uploaded_by === state.user.id || canDeleteAny()) ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteContent(${c.id})" title="Delete">🗑</button>` : ''}                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? paginationBar(page, totalPages) : ''}`}
    </div>`;
  if (state.searchTerm) {
    const si = document.getElementById('contentSearch');
    if (si) si.value = state.searchTerm;
  }
}

function pageNumberList(current, total) {
  const out = [];
  const add = n => { if (out[out.length - 1] !== n) out.push(n); };
  if (total <= 7) {
    for (let i = 1; i <= total; i++) add(i);
    return out;
  }
  add(1);
  if (current > 3) add('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) add(i);
  if (current < total - 2) add('…');
  add(total);
  return out;
}

function paginationBar(page, totalPages) {
  const nums = pageNumberList(page, totalPages).map(n => n === '…'
    ? '<span class="page-dots">…</span>'
    : `<button class="page-btn${n === page ? ' active' : ''}" onclick="setContentsPage(${n})">${n}</button>`).join('');
  return `
    <div class="pagination">
      <button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="setContentsPage(${page - 1})">‹ Prev</button>
      ${nums}
      <button class="page-btn" ${page === totalPages ? 'disabled' : ''} onclick="setContentsPage(${page + 1})">Next ›</button>
    </div>`;
}

function setContentsPage(n) {
  state.contentsPage = n;
  go('contents');
}

/* ================= ARCHIVE ================= */

function archiveMonthLabel(m) {
  const [y, mo] = String(m).split('-').map(Number);
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleString([], { month: 'long', year: 'numeric' });
}

function archiveContentRow(c) {
  const plinks = PLATFORMS.filter(p => c[p.key] && c[p.key].trim()).map(p =>
    `<span class="link-cell"><a class="link-pill" href="${esc(c[p.key])}" target="_blank" rel="noopener">${p.icon} ${p.label}</a><button class="copy-btn" title="Copy ${p.label} link" data-copy="${esc(c[p.key])}" onclick="event.stopPropagation(); copyFrom(this)">📋</button></span>`
  ).join(' ') || '<span class="small">—</span>';
  return `
    <div class="archive-item">
      <div class="a-date">${fmtDate(c.upload_date)} <span class="small">· ${c.slot_label ? c.slot_label : slotLabel(c.upload_time)}</span></div>
      <div class="a-head">${esc(c.headline || c.slug || '—')} ${catTag(c.category)} ${c.sponsor_name ? `<span class="tag ${c.sponsor_deleted ? 'tag-deleted' : 'tag-gold'}" style="font-size:10px;">${esc(c.sponsor_name)}</span>` : ''}</div>
      <div class="a-links">${plinks}</div>
    </div>`;
}

async function renderArchive(vc) {
  const data = await api('/api/contents');
  state.contents = data.contents;
  const all = data.contents;
  const dFrom = state.archiveDateFrom;
  const dTo = state.archiveDateTo;
  const cat = state.archiveCategory === 'video' || state.archiveCategory === 'static' ? state.archiveCategory : 'all';
  const matches = c => {
    const d = c.upload_date || '';
    if (!d) return false;
    if (dFrom && d < dFrom) return false;
    if (dTo && d > dTo) return false;
    if (cat !== 'all' && c.category !== cat) return false;
    return true;
  };
  const groups = {};
  for (const c of all) {
    const m = c.upload_date ? c.upload_date.slice(0, 7) : null;
    if (!m || !matches(c)) continue;
    (groups[m] = groups[m] || []).push(c);
  }
  const months = Object.keys(groups).sort().reverse();
  const years = [];
  for (let y = 2100; y >= 1980; y--) years.push(String(y));
  const curYear = String(new Date().getFullYear());
  const yActive = state.archiveYear === 'all'
    ? 'all'
    : (/^\d{4}$/.test(state.archiveYear) && state.archiveYear >= '1980' && state.archiveYear <= '2100' ? state.archiveYear : curYear);
  if (yActive !== state.archiveYear) state.archiveYear = yActive;
  const mActive = state.archiveMonth !== 'all' && state.archiveMonth.length === 2 ? state.archiveMonth : 'all';
  if (mActive !== state.archiveMonth) state.archiveMonth = mActive;
  let shown;
  if (mActive !== 'all') {
    shown = yActive !== 'all'
      ? (months.includes(yActive + '-' + mActive) ? [yActive + '-' + mActive] : [])
      : months.filter(k => k.slice(5) === mActive);
  } else if (yActive !== 'all') {
    shown = months.filter(k => k.slice(0, 4) === yActive);
  } else {
    shown = months;
  }
  const visible = shown.flatMap(m => groups[m] || []);
  const visibleLinks = visible.reduce((n, c) => n + PLATFORMS.filter(p => c[p.key] && c[p.key].trim()).length, 0);
  const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString([], { month: 'long' }));
  const exportUrl = fmt => {
    const p = new URLSearchParams({ format: fmt });
    if (yActive !== 'all') { p.set('year', yActive); if (mActive !== 'all') p.set('month', mActive); }
    if (dFrom) p.set('from', dFrom);
    if (dTo) p.set('to', dTo);
    if (cat !== 'all') p.set('category', cat);
    return '/api/archive/export?' + p.toString();
  };
  vc.innerHTML = `
    <div class="panel">
      <div class="corner-label">🗄️ <span class="em">ARCHIVE</span></div>
      <div class="flex mb-14" style="gap:10px; flex-wrap:wrap;">
        <select class="input" style="width:auto;" onchange="setArchiveYear(this.value)">
          <option value="all" ${yActive === 'all' ? 'selected' : ''}>All years</option>
          ${years.map(y => `<option value="${y}" ${yActive === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
        <select class="input" style="width:auto;" onchange="setArchiveMonth(this.value)">
          <option value="all" ${mActive === 'all' ? 'selected' : ''}>All months</option>
          ${monthNames.map((name, i) => { const v = String(i + 1).padStart(2, '0'); return `<option value="${v}" ${mActive === v ? 'selected' : ''}>${name}</option>`; }).join('')}
        </select>
        <select class="input" style="width:auto;" onchange="setArchiveCategory(this.value)">
          <option value="all" ${cat === 'all' ? 'selected' : ''}>Video + Static</option>
          <option value="video" ${cat === 'video' ? 'selected' : ''}>🎬 Video only</option>
          <option value="static" ${cat === 'static' ? 'selected' : ''}>🖼️ Static only</option>
        </select>
        <span class="input-group" style="display:flex;align-items:center;gap:6px;">
          <label class="small" style="margin:0;">From</label>
          <input class="input" type="date" value="${esc(dFrom)}" onchange="setArchiveDateFrom(this.value)" style="width:auto;">
          <label class="small" style="margin:0;">To</label>
          <input class="input" type="date" value="${esc(dTo)}" onchange="setArchiveDateTo(this.value)" style="width:auto;">
          ${(dFrom || dTo) ? `<button class="btn btn-ghost btn-sm" onclick="setArchiveDateFrom('');setArchiveDateTo('');">✖ Clear</button>` : ''}
        </span>
        <span class="spacer"></span>
        ${visible.length ? `<a class="btn btn-ghost" href="${exportUrl('pdf')}" download>📄 PDF</a>
        <a class="btn btn-gold" href="${exportUrl('excel')}" download>📊 Excel</a>` : ''}
        ${visibleLinks ? `<button class="btn btn-ghost" onclick="copyMonthLinks('all')">📋 Copy All Links</button>` : ''}
      </div>
      <div class="archive-summary">
        <span class="tag tag-gold">${visible.length} content${visible.length === 1 ? '' : 's'}</span>
        <span class="tag tag-blue">${visibleLinks} links</span>
        <span class="small">${yActive === 'all' ? 'All years' : yActive}${yActive !== 'all' && mActive !== 'all' ? ' · ' + archiveMonthLabel(yActive + '-' + mActive) : ''}${cat !== 'all' ? ' · ' + cat.toUpperCase() : ''}${dFrom || dTo ? ' · ' + (dFrom || '…') + ' → ' + (dTo || '…') : ''}</span>
      </div>
    </div>
    ${shown.length === 0
      ? `<div class="panel"><div class="empty">${yActive === 'all' && mActive === 'all' && !dFrom && !dTo ? 'Archive is empty.' : 'No matching contents found.'}</div></div>`
      : shown.map(m => {
          const list = groups[m].slice().sort((a, b) => (a.upload_date + a.upload_time) < (b.upload_date + b.upload_time) ? 1 : -1);
          const mLinks = list.reduce((n, c) => n + PLATFORMS.filter(p => c[p.key] && c[p.key].trim()).length, 0);
          return `
          <div class="panel archive-month">
            <div class="flex mb-14">
              <h3 style="margin:0;"><span class="em">${archiveMonthLabel(m)}</span> <span class="tag tag-blue" style="font-size:11px;">${list.length} content${list.length === 1 ? '' : 's'} · ${mLinks} links</span></h3>
              <span class="spacer"></span>
              ${mLinks ? `<button class="btn btn-ghost btn-sm" onclick="copyMonthLinks('${m}')">📋 Copy All</button>` : ''}
            </div>
            ${list.map(c => archiveContentRow(c)).join('')}
          </div>`;
        }).join('')}
  `;
}

function setArchiveMonth(m) { state.archiveMonth = m; state.archiveDate = ''; go('archive'); }

function setArchiveYear(y) { state.archiveYear = y; state.archiveDate = ''; go('archive'); }

function setArchiveDate(d) { state.archiveDate = d || ''; go('archive'); }

function setArchiveDateFrom(d) { state.archiveDateFrom = d || ''; go('archive'); }

function setArchiveDateTo(d) { state.archiveDateTo = d || ''; go('archive'); }

function setArchiveCategory(c) { state.archiveCategory = c || 'all'; go('archive'); }

function copyMonthLinks(month) {
  let list = state.contents || [];
  let label;
  if (state.archiveDate) {
    list = list.filter(c => (c.upload_date || '') === state.archiveDate);
    label = `${fmtDate(state.archiveDate)} links`;
  } else {
    if (month === 'all' && state.archiveMonth !== 'all') month = state.archiveMonth;
    if (month !== 'all') list = list.filter(c => (c.upload_date || '').slice(0, 7) === month);
    label = month === 'all' ? 'All links' : 'Month links';
  }
  const lines = [];
  for (const c of list) {
    const links = PLATFORMS.filter(p => c[p.key] && c[p.key].trim()).map(p => `${p.label}: ${c[p.key]}`);
    if (links.length) lines.push(`${c.headline || c.slug || 'content #' + c.id}\n  ${links.join('\n  ')}`);
  }
  if (!lines.length) return toast('No links to copy.', 'error');
  copyText(lines.join('\n\n'), label);
}

function contentDateRange() {
  const f = state.contentDateFilter;
  if (f === 'all') return null;
  if (f === 'week') return { from: daysAgoIso(7), to: todayStr() };
  if (f === '1m') return { from: monthsAgoIso(1), to: todayStr() };
  if (f === '2m') return { from: monthsAgoIso(2), to: todayStr() };
  if (f === '3m') return { from: monthsAgoIso(3), to: todayStr() };
  if (f === '6m') return { from: monthsAgoIso(6), to: todayStr() };
  if (f === '1y') return { from: monthsAgoIso(12), to: todayStr() };
  if (f === 'custom') return { from: state.contentDateFrom || null, to: state.contentDateTo || null };
  if (f === 'date') return state.contentDateSingle ? { from: state.contentDateSingle, to: state.contentDateSingle } : null;
  if (f === 'month') {
    const y = state.contentMonthYear, m = state.contentMonth;
    if (!y || !m) return null;
    const last = new Date(y, m, 0).getDate();
    return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
  }
  return null;
}

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthsAgoIso(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function contentDateFilterLabel() {
  const f = state.contentDateFilter;
  if (f === 'all') return '';
  if (f === 'week') return 'Last 1 Week';
  if (f === '1m') return 'Last 1 Month';
  if (f === '2m') return 'Last 2 Months';
  if (f === '3m') return 'Last 3 Months';
  if (f === '6m') return 'Last 6 Months';
  if (f === '1y') return 'Last 1 Year';
  if (f === 'custom') return `Custom: ${state.contentDateFrom || '?'} → ${state.contentDateTo || '?'}`;
  if (f === 'date') return state.contentDateSingle ? `Date: ${state.contentDateSingle}` : 'Specific Date';
  if (f === 'month') return state.contentMonth ? `${MONTH_SHORT[state.contentMonth - 1]} ${state.contentMonthYear || ''}` : 'Custom Month';
  return '';
}

function contentYearOptions() {
  const years = new Set();
  const cur = new Date().getFullYear();
  state.contents.forEach(c => { if (c.upload_date) years.add(Number(c.upload_date.slice(0, 4))); });
  years.add(cur);
  return Array.from(years).sort((a, b) => a - b);
}

function setContentCategoryFilter(f) { state.contentCategoryFilter = f; state.contentsPage = 1; saveContentPrefs(); go('contents'); }

function contentSlotKey(c) {
  return c.slot_label ? 'L:' + c.slot_label : (c.upload_time ? 'T:' + c.upload_time : '');
}

function contentSlotLabel(key) {
  if (!key) return '';
  return key.startsWith('L:') ? key.slice(2) : slotLabel(key.slice(2));
}

function contentSlotOptions(contents) {
  const seen = new Set(), out = [];
  const push = k => { if (k && !seen.has(k)) { seen.add(k); out.push(k); } };
  contents.forEach(c => push(contentSlotKey(c)));
  return out.sort((a, b) => {
    const A = a.startsWith('L:'), B = b.startsWith('L:');
    if (A !== B) return A ? 1 : -1;
    return contentSlotLabel(a).localeCompare(contentSlotLabel(b));
  });
}

function setContentSlotFilter(f) { state.contentSlotFilter = f; state.contentsPage = 1; saveContentPrefs(); go('contents'); }

const SEARCH_PLACEHOLDERS = {
  all: '🔍 Search date, slot, type, member, headline, sponsor…',
  date: '🔍 Search date (e.g. Aug, 2026, 10)…',
  slot: '🔍 Search slot (e.g. 6:00 PM, UNCUT-CLIP)…',
  type: '🔍 Search type (video / static)…',
  member: '🔍 Search uploaded by…',
  headline: '🔍 Search slug / headline…',
  sponsor: '🔍 Search sponsor…'
};

function contentSearchText(c, field) {
  if (field === 'date') return `${c.upload_date || ''} ${fmtDate(c.upload_date)}`;
  if (field === 'slot') return contentSlotLabel(contentSlotKey(c));
  if (field === 'type') return catInfo(c.category || 'video').label;
  if (field === 'member') return c.uploaded_by_name || '';
  if (field === 'headline') return `${c.headline || ''} ${c.slug || ''}`;
  if (field === 'sponsor') return c.sponsor_name || '';
  return `${c.headline || ''} ${c.slug || ''} ${c.uploaded_by_name || ''} ${c.sponsor_name || ''} ${contentSlotLabel(contentSlotKey(c))} ${c.upload_date || ''} ${fmtDate(c.upload_date)} ${catInfo(c.category || 'video').label}`;
}

function setContentSearchField(f) { state.contentSearchField = f; state.contentsPage = 1; saveContentPrefs(); go('contents'); }

function setContentDateFilter(f) {
  state.contentDateFilter = f;
  if (f === 'month') {
    const now = new Date();
    if (!state.contentMonth) state.contentMonth = now.getMonth() + 1;
    if (!state.contentMonthYear) state.contentMonthYear = now.getFullYear();
  }
  state.contentsPage = 1;
  saveContentPrefs();
  go('contents');
}
function setContentDateFrom(v) { state.contentDateFrom = v; state.contentsPage = 1; saveContentPrefs(); go('contents'); }
function setContentDateTo(v) { state.contentDateTo = v; state.contentsPage = 1; saveContentPrefs(); go('contents'); }
function setContentDateSingle(v) { state.contentDateSingle = v; state.contentsPage = 1; saveContentPrefs(); go('contents'); }
function setContentMonth(v) { state.contentMonth = Number(v); state.contentsPage = 1; saveContentPrefs(); go('contents'); }
function setContentMonthYear(v) { state.contentMonthYear = Number(v); state.contentsPage = 1; saveContentPrefs(); go('contents'); }

async function openContentDetail(id) {
  let c = state.contents.find(x => x.id === id);
  if (!c) {
    try { c = (await api('/api/contents/' + id)).content; }
    catch (e) { toast(e.message, 'error'); return; }
  }
  if (!c) return;
  const links = PLATFORMS.filter(p => c[p.key] && c[p.key].trim());
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>🗂️ Content Details <button class="close-x" onclick="closeModal()">✕</button></h3>
        <div class="tracker-item">
          <div class="t-head">
            <div class="t-name">${esc(c.headline || '—')}</div>
            <div class="t-date">${fmtDate(c.upload_date)} · ${c.slot_label ? `${c.slot_label} · ` : ''}${slotLabel(c.upload_time)} · ${catTag(c.category)}</div>
          </div>
          <div class="small mb-14">Slug: <span class="mono">${esc(c.slug || '—')}</span></div>
          <div class="small mb-14">Uploaded by: <b>${esc(c.uploaded_by_name)}</b>${c.uploaded_by_office || c.uploaded_by_designation ? ` (${esc([c.uploaded_by_office, c.uploaded_by_designation].filter(Boolean).join(' · '))})` : ''}</div>
          <div class="mb-14">Sponsor: ${c.sponsor_name
            ? `<span class="tag ${c.sponsor_deleted ? 'tag-deleted' : 'tag-gold'}"${c.sponsor_deleted ? ' title="Sponsor deleted"' : ''}>${esc(c.sponsor_name)}${c.sponsor_deleted ? ' (deleted)' : ''}</span>`
            : '<span class="tag tag-gray">None</span>'}</div>
          ${links.length === 0 ? '<div class="small">No links added.</div>' : `
          <div>
            <div class="small" style="margin-bottom:6px;font-weight:800;">Platform Links:</div>
            ${links.map(p => `<div class="mb-14"><span class="link-pill">${p.icon} ${p.label}</span> <a href="${esc(c[p.key])}" target="_blank" rel="noopener" class="mono">${esc(c[p.key])}</a></div>`).join('')}
          </div>`}
        </div>
        <div class="flex mt-14">
          <button class="btn btn-ghost" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>`;
}

async function filterContentTable() {
  const q = (document.getElementById('contentSearch').value || '').trim().toLowerCase();
  state.searchTerm = q;
  state.contentsPage = 1;
  saveContentPrefs();
  await renderContents(document.getElementById('viewContainer'));
  const si = document.getElementById('contentSearch');
  if (si) {
    si.value = q;
    si.focus();
    si.setSelectionRange(q.length, q.length);
  }
}

async function deleteContent(id) {
  const c = (state.contents || []).find(x => x.id === id) || {};
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>🗑️ Delete Content <button class="close-x" onclick="closeModal()">✕</button></h3>
        <p class="small mb-14">এই কনটেন্টটি TRASH LIST-এ রেকর্ড হয়ে যাবে।</p>
        <div class="tracker-item" style="margin-bottom:14px;">
          <div class="t-head">
            <div class="t-name">${esc(c.headline || c.slug || '—')}</div>
            <div class="t-date">${fmtDate(c.upload_date)} · ${c.slot_label ? `${c.slot_label} · ` : ''}${slotLabel(c.upload_time)} · ${esc(c.uploaded_by_name || '')}</div>
          </div>
        </div>
        <div class="form-group mb-14">
          <label>Remarks (কেন ডিলিট করছেন?) <span class="small">— TRASH LIST-এ দেখাবে</span></label>
          <textarea class="input" id="delRemark" rows="3" placeholder="e.g. ভুল তথ্য / ডুপ্লিকেট / ভুল স্লট / অপ্রয়োজনীয়…"></textarea>
        </div>
        <div class="flex">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <span class="spacer"></span>
          <button class="btn btn-danger" onclick="doDeleteContent(${id})">🗑 Delete Content</button>
        </div>
      </div>
    </div>`;
}

async function doDeleteContent(id) {
  const remark = document.getElementById('delRemark').value.trim();
  try {
    await api('/api/contents/' + id, { method: 'DELETE', body: JSON.stringify({ remark }) });
    toast('Moved to TRASH ✓', 'success');
    closeModal();
    go('contents');
  } catch (e) { toast(e.message, 'error'); closeModal(); }
}

/* ================= SPONSORS ================= */

async function renderSponsors(vc) {
  const data = await api('/api/sponsors');
  state.sponsors = data.sponsors;
  const isManager = canManage();
  const filter = state.sponsorStatusFilter || 'all';
  const STATUS_ORDER = ['active', 'paused', 'completed', 'cancel'];
  const STATUS_LABELS = { active: 'ACTIVE SPONSOR', paused: 'PAUSE SPONSOR', completed: 'COMPLETED SPONSOR', cancel: 'CANCEL SPONSOR' };
  const groups = STATUS_ORDER
    .filter(st => filter === 'all' || filter === st)
    .map(st => ({ st, list: data.sponsors.filter(sp => sp.status === st) }))
    .filter(g => g.list.length > 0);

  vc.innerHTML = `
    <div class="flex mb-14">
      ${isManager ? `<button class="btn btn-gold" onclick="openSponsorForm()">＋ Add Sponsor</button>` : ''}
      <span class="spacer"></span>
      <button class="btn btn-ghost" onclick="openSponsorTracker()">📊 Sponsor Tracker</button>
    </div>
    <div class="flex mb-14" style="flex-wrap:wrap; gap:10px;">
      <input class="input" id="sponsorSearch" placeholder="🔍 Search sponsor name, note…" style="max-width:380px;" oninput="filterSponsorTable()">
      <select class="input" id="sponsorStatusFilter" style="max-width:210px;" onchange="setSponsorStatusFilter(this.value)">
        <option value="all" ${filter === 'all' ? 'selected' : ''}>All Sponsors</option>
        <option value="active" ${filter === 'active' ? 'selected' : ''}>ACTIVE SPONSOR</option>
        <option value="paused" ${filter === 'paused' ? 'selected' : ''}>PAUSE SPONSOR</option>
        <option value="completed" ${filter === 'completed' ? 'selected' : ''}>COMPLETED SPONSOR</option>
        <option value="cancel" ${filter === 'cancel' ? 'selected' : ''}>CANCEL SPONSOR</option>
      </select>
      <span class="tag tag-gold" style="font-size:12px;" id="sponsorCountTag">${data.sponsors.length} sponsor${data.sponsors.length === 1 ? '' : 's'}</span>
    </div>
    ${data.sponsors.length === 0
      ? '<div class="panel"><div class="empty">No sponsors yet. ' + (isManager ? 'Add your first sponsor to start tracking daily targets and deadlines.' : '') + '</div></div>'
      : (groups.length === 0
          ? '<div class="panel"><div class="empty">No sponsors in this status.</div></div>'
          : groups.map(g => `
            <div class="sponsor-group">
              <div class="sponsor-group-title">${STATUS_LABELS[g.st]}</div>
              <div class="sponsor-grid">
                ${g.list.map(sp => {
                  const t = sp.today, d = sp.deadline_;
                  const stopMsg = { completed: '✓ Sponsor completed', paused: '⏸️ Sponsor paused', cancel: '✖ Sponsor canceled' }[sp.status];
                  const urgent = !stopMsg && d && d.days_left !== null && d.days_left <= 5 && d.remaining > 0;
                  const hasContent = Number(sp.content_count) > 0;
                  return `
                  <div class="sponsor-card" style="${stopMsg ? 'opacity:0.75;' : ''}" data-search="${esc((sp.name + ' ' + (sp.content_type || '') + ' ' + (sp.note || '') + (hasContent ? ' content' : '')).toLowerCase())}" data-contentcount="${hasContent ? 1 : 0}" onclick="openSponsorDetail(${sp.id})" title="Click for full tracking details">
                    <div class="flex">
                      <div style="flex:1;">
                        <div class="s-name">${esc(sp.name)} ${hasContent ? `<span class="tag tag-blue" style="font-size:10px;">${sp.content_count} video${sp.content_count == 1 ? '' : 's'}</span>` : ''}</div>
                        <div class="s-period">${sp.content_type ? `<span class="tag tag-gold" style="font-size:10px;">${esc(sp.content_type)}</span> ` : ''}${fmtDate(sp.start_date)} → ${fmtDate(sp.deadline)}</div>
                      </div>
                      <span class="tag ${sp.status === 'active' ? 'tag-active' : sp.status === 'paused' ? 'tag-paused' : sp.status === 'cancel' ? 'tag-cancel' : 'tag-completed'}">${esc(sp.status)}</span>
                    </div>
                    <div class="meter-row">
                      <div class="m-label"><span>🎯 Today (${fmtDate(todayStr())})</span><span class="m-val">${t.done} / ${t.target || 'no target'}</span></div>
                      <div class="progress"><div style="width:${t.target ? Math.min(100, t.done / t.target * 100) : 0}%"></div></div>
                      ${stopMsg ? `<div class="small mt-8">${stopMsg}</div>` : (t.target > 0 ? `<div class="small mt-8">${t.remaining === 0 ? '✓ Today\'s target complete' : `${t.remaining} more needed today`}</div>` : '')}
                    </div>
                    <div class="meter-row">
                      <div class="m-label"><span>⏰ Contract ${d.done} / ${sp.total_videos}</span><span class="m-val">${d.percent_done}%</span></div>
                      <div class="progress ${urgent ? 'progress-red' : ''}"><div style="width:${d.percent_done}%"></div></div>
                      <div class="small mt-8">${stopMsg ? `${stopMsg}` : (d.days_left === null ? 'No deadline set' : (d.days_left < 0 ? '⛔ Deadline crossed, still ' + d.remaining + ' remaining' : d.remaining === 0 ? '✓ Contract complete' : `${d.remaining} remaining · ${d.days_left}d left · need ~${d.need_per_day ?? '?'}/day`))}</div>
                    </div>
                    <div class="sponsor-actions">
                      <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); downloadPdf('/api/report/sponsor/${sp.id}?format=pdf')">📄 Report</button>
                      ${isManager ? `
                        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openSponsorForm(${sp.id})">✏️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteSponsor(${sp.id})">🗑</button>` : ''}
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>`).join(''))}
  `;
  if (state.sponsorSearch) {
    const si = document.getElementById('sponsorSearch');
    if (si) { si.value = state.sponsorSearch; filterSponsorTable(); }
  }
}

function setSponsorStatusFilter(v) {
  state.sponsorStatusFilter = v;
  renderSponsors(document.getElementById('viewContainer'));
}

function filterSponsorTable() {
  const si = document.getElementById('sponsorSearch');
  const q = (si ? si.value.trim().toLowerCase() : '').trim().toLowerCase();
  state.sponsorSearch = q;
  const cards = document.querySelectorAll('.sponsor-grid .sponsor-card');
  let visible = 0;
  cards.forEach(card => {
    const show = !q || card.dataset.search.includes(q);
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const tag = document.getElementById('sponsorCountTag');
  if (tag) tag.textContent = `${visible} of ${cards.length} sponsor${cards.length === 1 ? '' : 's'}`;
}

async function renderReports(vc) {
  const isOwner = state.user.role === 'owner' || state.user.access === 'owner';
  let sponsors = [];
  let users = [];
  let contents = [];
  try { sponsors = (await api('/api/sponsors')).sponsors; } catch (e) {}
  try { users = (await api('/api/users')).users; } catch (e) {}
  try { contents = (await api('/api/contents')).contents; } catch (e) {}
  if (state.reportType === 'employee' && !isOwner) state.reportType = 'sponsor';
  if (sponsors.length && !state.reportSponsorId) state.reportSponsorId = sponsors[0].id;
  if (sponsors.length && !sponsors.find(s => s.id === state.reportSponsorId)) state.reportSponsorId = sponsors[0].id;
  if (users.length && !state.reportEmployeeId) state.reportEmployeeId = users[0].id;
  if (users.length && !users.find(u => u.id === state.reportEmployeeId)) state.reportEmployeeId = users[0].id;
  const slotKeys = contentSlotOptions(contents);
  if (state.reportSlot && !slotKeys.includes(state.reportSlot)) state.reportSlot = '';
  if (!state.reportSlot && slotKeys.length) state.reportSlot = slotKeys[0];
  state.reportSlotOptions = slotKeys;
  const t = state.reportType;
  const fmt = state.reportFormat;
  const needSponsor = t === 'sponsor' || t === 'tracking';
  const needSlot = t === 'slot';
  const needFormat = t === 'sponsor' || t === 'employee' || t === 'timing' || t === 'slot';
  if (state.reportMonth < 1 || !state.reportYear) {
    const now = new Date();
    state.reportMonth = now.getMonth() + 1;
    state.reportYear = now.getFullYear();
  }
  if (!state.reportRangeDate) state.reportRangeDate = todayStr();
  if (!state.reportRangeFrom) state.reportRangeFrom = todayStr();
  if (!state.reportRangeTo) state.reportRangeTo = todayStr();
  if (!state.reportRangeYear) state.reportRangeYear = new Date().getFullYear();

  vc.innerHTML = `
    <div class="panel" style="max-width:760px;">
      <h3>📄 <span class="em">Reports</span></h3>
      <p class="small mb-14">ড্রপডাউন থেকে রিপোর্টের ধরন ও ক্যাটাগরি সিলেক্ট করে এক ক্লিকে PDF / CSV ডাউনলোড করুন। সময়কাল (Time Period) ফিল্টার থেকে নির্দিষ্ট তারিখ, কাস্টম রেঞ্জ, ৩ দিন, সাপ্তাহিক, মাসিক বা বাৎসরিক সিলেক্ট করলে ওই সময়ের রিপোর্টই তৈরি হবে।</p>
      <div class="form-group">
        <label>Report Type</label>
        <select class="input" onchange="setReportType(this.value)">
          <option value="sponsor" ${t === 'sponsor' ? 'selected' : ''}>Sponsor Report (SL · Date · Headline · Links)</option>
          <option value="tracking" ${t === 'tracking' ? 'selected' : ''}>Sponsor Tracking (Full Details PDF)</option>
          ${isOwner ? `<option value="employee" ${t === 'employee' ? 'selected' : ''}>Employee Report (SL · Date · Headline · Links)</option>` : ''}
          <option value="slot" ${t === 'slot' ? 'selected' : ''}>Slot Report (Upload Content by Slot)</option>
          <option value="all" ${t === 'all' ? 'selected' : ''}>All Sponsors Summary PDF</option>
          <option value="timing" ${t === 'timing' ? 'selected' : ''}>Office Timing Report (Check In/Out)</option>
        </select>
      </div>
      <div class="form-group">
        <label>সময়কাল (Time Period)</label>
        <div class="flex" style="gap:8px;flex-wrap:wrap;">
          <select class="input" style="max-width:230px;" onchange="setReportRange(this.value)">
            <option value="all" ${state.reportRange === 'all' ? 'selected' : ''}>সব সময় (All Time)</option>
            <option value="date" ${state.reportRange === 'date' ? 'selected' : ''}>📅 নির্দিষ্ট তারিখ (Specific Date)</option>
            <option value="custom" ${state.reportRange === 'custom' ? 'selected' : ''}>🔁 কাস্টম রেঞ্জ (From → To)</option>
            <option value="3d" ${state.reportRange === '3d' ? 'selected' : ''}>⏱ সর্বশেষ ৩ দিন (Last 3 Days)</option>
            <option value="week" ${state.reportRange === 'week' ? 'selected' : ''}>📆 সাপ্তাহিক (This Week · 7 দিন)</option>
            <option value="monthly" ${state.reportRange === 'monthly' ? 'selected' : ''}>🗓 মাসিক (Monthly)</option>
            <option value="yearly" ${state.reportRange === 'yearly' ? 'selected' : ''}>📅 বাৎসরিক (Yearly)</option>
          </select>
          ${state.reportRange === 'date' ? `<input type="date" class="input" style="max-width:170px;" value="${state.reportRangeDate}" onchange="setReportRangeDate(this.value)">` : ''}
          ${state.reportRange === 'custom' ? `<input type="date" class="input" style="max-width:170px;" value="${state.reportRangeFrom}" onchange="setReportRangeFrom(this.value)"><span class="small">→</span><input type="date" class="input" style="max-width:170px;" value="${state.reportRangeTo}" onchange="setReportRangeTo(this.value)">` : ''}
          ${state.reportRange === 'monthly' ? `<select class="input" style="max-width:170px;" onchange="setReportRangeMonth(this.value)">${reportMonthOptions(state.reportYear + '-' + String(state.reportMonth).padStart(2, '0'))}</select>` : ''}
          ${state.reportRange === 'yearly' ? `<select class="input" style="max-width:140px;" onchange="setReportRangeYear(this.value)">${reportYearOptions(state.reportRangeYear)}</select>` : ''}
        </div>
      </div>
      ${t === 'timing' ? `
      <div class="form-group">
        <label>Employee</label>
        <select class="input" onchange="setReportUser(this.value)">
          <option value="0" ${state.reportUserId === 0 ? 'selected' : ''}>All Users (একসাথে সবার রিপোর্ট)</option>
          ${users.map(u => `<option value="${u.id}" ${state.reportUserId === u.id ? 'selected' : ''}>${esc(u.username)}${u.designation ? ' — ' + esc(u.designation) : ''}</option>`).join('')}
        </select>
      </div>` : ''}
      ${needSlot ? `
      <div class="form-group">
        <label>Slot</label>
        <select class="input" onchange="setReportSlot(this.value)">
          ${slotKeys.length ? slotKeys.map(k => `<option value="${esc(k)}" ${state.reportSlot === k ? 'selected' : ''}>${esc(contentSlotLabel(k))}</option>`).join('') : '<option value="">No slots yet (upload content first)</option>'}
        </select>
      </div>` : ''}
      ${needSponsor ? `
      <div class="form-group">
        <label>Sponsor</label>
        <select class="input" onchange="setReportSponsor(this.value)">
          ${sponsors.length ? sponsors.map(s => `<option value="${s.id}" ${state.reportSponsorId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('') : '<option value="0">No sponsors yet</option>'}
        </select>
      </div>` : ''}
      ${t === 'employee' ? `
      <div class="form-group">
        <label>Employee</label>
        <select class="input" onchange="setReportEmployee(this.value)">
          ${users.map(u => `<option value="${u.id}" ${state.reportEmployeeId === u.id ? 'selected' : ''}>${esc(u.username)}${u.designation ? ' — ' + esc(u.designation) : ''}</option>`).join('')}
        </select>
      </div>` : ''}
      ${needFormat ? `
      <div class="form-group">
        <label>Format</label>
        <select class="input" style="max-width:220px;" onchange="setReportFormat(this.value)">
          <option value="pdf" ${fmt === 'pdf' ? 'selected' : ''}>📄 PDF</option>
          <option value="csv" ${fmt === 'csv' ? 'selected' : ''}>📋 CSV (Excel)</option>
        </select>
      </div>` : ''}
      <div class="flex mt-20">
        <button class="btn btn-gold" onclick="generateReport()">📥 Generate Report</button>
        <span class="small" id="rpHint">${reportHint(t, fmt)}</span>
      </div>
    </div>
  `;
}

function reportHint(t, fmt) {
  const period = reportPeriodText();
  const per = period === 'All Time' ? '' : ` (${period})`;
  if (t === 'sponsor') return fmt === 'csv' ? `Sponsor report (SL · Headline · Links) as CSV${per}.` : `Sponsor report (SL · Headline · Links) as PDF${per}.`;
  if (t === 'tracking') return `Full sponsor tracking PDF with daily progress${per}.`;
  if (t === 'employee') return fmt === 'csv' ? `Employee report (SL · Headline · Links) as CSV${per}.` : `Employee report (SL · Headline · Links) as PDF${per}.`;
  if (t === 'slot') return fmt === 'csv' ? `Slot report (Date · Sponsor · Uploader · Headline · Links) as CSV${per}.` : `Slot report (Date · Sponsor · Uploader · Headline · Links) as PDF${per}.`;
  if (t === 'timing') return fmt === 'csv' ? `Office timing report (Check In/Out) as CSV${per}.` : `Office timing report (Check In/Out) as PDF${per}.`;
  return `Summary PDF of all sponsors${per}.`;
}

function setReportType(v) { state.reportType = v; go('reports'); }
function setReportSponsor(v) { state.reportSponsorId = Number(v); go('reports'); }
function setReportEmployee(v) { state.reportEmployeeId = Number(v); go('reports'); }
function setReportFormat(v) { state.reportFormat = v; go('reports'); }
function setReportUser(v) { state.reportUserId = Number(v); go('reports'); }
function setReportRange(v) { state.reportRange = v; go('reports'); }
function setReportRangeDate(v) { state.reportRangeDate = v; go('reports'); }
function setReportRangeFrom(v) { state.reportRangeFrom = v; go('reports'); }
function setReportRangeTo(v) { state.reportRangeTo = v; go('reports'); }
function setReportSlot(v) { state.reportSlot = v; go('reports'); }
function setReportRangeMonth(v) {
  const [y, m] = String(v).split('-');
  state.reportYear = Number(y);
  state.reportMonth = Number(m);
  go('reports');
}
function setReportRangeYear(v) { state.reportRangeYear = Number(v); go('reports'); }
function setReportMonth(v) {
  const [y, m] = String(v).split('-');
  state.reportYear = Number(y);
  state.reportMonth = Number(m);
  go('reports');
}

function reportYearOptions(sel) {
  const now = new Date().getFullYear();
  let opts = '';
  for (let y = now; y >= now - 10; y--) {
    opts += `<option value="${y}" ${y === Number(sel) ? 'selected' : ''}>${y}</option>`;
  }
  return opts;
}

function reportMonthOptions(sel) {
  const now = new Date();
  let opts = '';
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString([], { month: 'long', year: 'numeric' });
    opts += `<option value="${key}" ${key === sel ? 'selected' : ''}>${label}</option>`;
  }
  return opts;
}

function reportRangeBounds() {
  const pad = n => String(n).padStart(2, '0');
  const d = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const today = new Date();
  if (state.reportRange === 'date') {
    const v = state.reportRangeDate || d(today);
    return { from: v, to: v };
  }
  if (state.reportRange === 'custom') {
    const f = state.reportRangeFrom || '', t2 = state.reportRangeTo || '';
    if (f && t2) return f <= t2 ? { from: f, to: t2 } : { from: t2, to: f };
    return { from: f, to: t2 };
  }
  if (state.reportRange === '3d') {
    const s = new Date(today); s.setDate(s.getDate() - 2);
    return { from: d(s), to: d(today) };
  }
  if (state.reportRange === 'week') {
    const s = new Date(today); s.setDate(s.getDate() - 6);
    return { from: d(s), to: d(today) };
  }
  if (state.reportRange === 'monthly') {
    const y = state.reportYear, m = state.reportMonth;
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${new Date(y, m, 0).getDate()}` };
  }
  if (state.reportRange === 'yearly') {
    const y = state.reportRangeYear || today.getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return { from: '', to: '' };
}

function reportPeriodText() {
  const b = reportRangeBounds();
  if (!b.from) return 'All Time';
  return `${b.from} → ${b.to}`;
}

function reportRangeQuery() {
  const b = reportRangeBounds();
  return b.from ? `?from=${b.from}&to=${b.to}` : '';
}

function generateReport() {
  const t = state.reportType;
  const rq = reportRangeQuery();
  const append = u => rq ? u + rq.replace('?', '&') : u;
  let url = '';
  if (t === 'sponsor') url = append(`/api/report/sponsor/${state.reportSponsorId}?format=${state.reportFormat}`);
  else if (t === 'employee') url = append(`/api/report/employee/${state.reportEmployeeId}?format=${state.reportFormat}`);
  else if (t === 'tracking') url = `/api/pdf/sponsor/${state.reportSponsorId}${rq}`;
  else if (t === 'slot') url = append(`/api/report/slot?slot=${encodeURIComponent(state.reportSlot || '')}&format=${state.reportFormat}`);
  else if (t === 'timing') url = append(`/api/report/timing?year=${state.reportYear}&month=${state.reportMonth}&user_id=${state.reportUserId || 0}&format=${state.reportFormat}`);
  else url = `/api/pdf/all${rq}`;
  downloadPdf(url);
}

function openSponsorForm(id) {
  const sp = id ? state.sponsors.find(x => x.id === id) : null;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>${sp ? '✏️ Edit Sponsor' : '＋ New Sponsor'}<button class="close-x" onclick="closeModal()">✕</button></h3>
        <div class="form-group"><label>Company / Sponsor Name *</label><input class="input" id="spName" value="${sp ? esc(sp.name) : ''}"></div>
        <div class="form-group"><label>Content Type *</label><input class="input" id="spContentType" value="${sp ? esc(sp.content_type) : ''}" placeholder="Ex: National, International, Sports or Any"></div>
        <div class="flex mb-14">
          <div class="form-group" style="flex:1;"><label>Contract Start Date *</label><input class="input" type="date" id="spStart" value="${sp ? esc(sp.start_date || '') : todayStr()}"></div>
          <div class="form-group" style="flex:1;"><label>Deadline *</label><input class="input" type="date" id="spDeadline" value="${sp ? esc(sp.deadline || '') : ''}"></div>
        </div>
        <div class="flex mb-14">
          <div class="form-group" style="flex:1;"><label>Total Videos (Whole Contract) *</label><input class="input" type="number" id="spTotal" min="1" value="${sp ? sp.total_videos : ''}" placeholder="e.g. 60"></div>
          <div class="form-group" style="flex:1;"><label>Daily Target (Videos/Day) *</label><input class="input" type="number" id="spDaily" min="1" value="${sp ? sp.daily_target : ''}" placeholder="e.g. 2"></div>
        </div>
        <div class="form-group"><label>Status *</label>
          <select class="input" id="spStatus">
            ${['active', 'paused', 'completed', 'cancel'].map(st => `<option value="${st}" ${sp && sp.status === st ? 'selected' : ''}>${st.charAt(0).toUpperCase() + st.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="flex">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <span class="spacer"></span>
          <button class="btn btn-gold" onclick="saveSponsor(${sp ? sp.id : 'null'})">💾 Save Sponsor</button>
        </div>
      </div>
    </div>`;
}

async function saveSponsor(id) {
  const name = document.getElementById('spName').value.trim();
  if (!name) return toast('Sponsor/company name is required.', 'error');
  const content_type = document.getElementById('spContentType').value.trim();
  if (!content_type) return toast('Content type is required (e.g. National, International, Sports).', 'error');
  const start_date = document.getElementById('spStart').value;
  if (!start_date) return toast('Contract start date is required.', 'error');
  const deadline = document.getElementById('spDeadline').value;
  if (!deadline) return toast('Deadline is required.', 'error');
  if (deadline < start_date) return toast('Deadline must be after start date.', 'error');
  const total_videos = Number(document.getElementById('spTotal').value);
  if (!total_videos || total_videos < 1) return toast('Total videos is required (min 1).', 'error');
  const daily_target = Number(document.getElementById('spDaily').value);
  if (!daily_target || daily_target < 1) return toast('Daily target is required (min 1).', 'error');
  const body = {
    name,
    content_type,
    start_date,
    deadline,
    total_videos,
    daily_target,
    status: document.getElementById('spStatus').value
  };
  try {
    if (id) { await api('/api/sponsors/' + id, { method: 'PUT', body: JSON.stringify(body) }); toast('Sponsor updated ✓', 'success'); }
    else { await api('/api/sponsors', { method: 'POST', body: JSON.stringify(body) }); toast('Sponsor added ✓', 'success'); }
    closeModal();
    go('sponsors');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteSponsor(id) {
  if (!confirm('Move this sponsor to trash? Uploads linked to it will show in RED until it is restored.')) return;
  try { await api('/api/sponsors/' + id, { method: 'DELETE' }); toast('Sponsor moved to trash', 'success'); go('sponsors'); } catch (e) { toast(e.message, 'error'); }
}

/* ================= TEAM ================= */

async function renderTeam(vc) {
  const data = await api('/api/users');
  state.teamUsers = data.users;
  const canMng = canManage();
  const pending = data.pending || [];
  vc.innerHTML = `
    ${canMng && pending.length ? `
    <div class="panel" style="border-color:rgba(255,199,9,0.4);">
      <h3>⏳ <span class="em">Pending Approvals</span> <span class="tag tag-gold" style="font-size:11px;">${pending.length} জন অপেক্ষমাণ</span></h3>
      <p class="small mb-14">নতুন রেজিস্ট্রেশনগুলো Owner/Manager অনুমোদন দিলেই অ্যাকাউন্ট সক্রিয় হবে — তারপর ব্যবহারকারী লগইন করতে পারবে।</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Office ID</th><th>Office Name</th><th>Designation</th><th>Contact</th><th>Actions</th></tr></thead>
          <tbody>
            ${pending.map((u, i) => {
              const wa = u.whatsapp ? String(u.whatsapp).replace(/[^0-9]/g, '') : '';
              return `
              <tr>
                <td><b>${esc(u.username)}</b><div class="small" style="color:var(--text-dim);">${esc(u.nickname || '')}</div></td>
                <td class="mono">${esc(u.office_id)}</td>
                <td>${esc(u.office_name || '—')}</td>
                <td>${esc(u.designation || '—')}</td>
                <td>
                  <div class="small">${esc(u.email)}</div>
                  ${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener" class="link-pill" title="WhatsApp-এ যোগাযোগ করুন">💬 ${esc(u.whatsapp)}</a>` : ''}
                </td>
                <td>
                  <div class="flex">
                    <button class="btn btn-sm btn-gold" onclick="approveUser(${u.id}, '${esc(u.username).replace(/'/g, "\\'")}')">✅ Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="rejectUser(${u.id}, '${esc(u.username).replace(/'/g, "\\'")}')">✖ Reject</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
    <div class="panel">
      <h3>👥 <span class="em">Team Members</span> <span class="tag tag-blue" style="font-size:11px;">${data.users.length} জন</span></h3>
      <p class="small mb-14">এক্সেস নির্ধারিত হয় Designation অনুযায়ী। Owner সবকিছু করতে পারে, Manager-এর full access, Assistant Manager / R&D input + delete access, বাকিরা নিজের input edit/delete + input access পায়। ${canMng ? '' : 'এডিট / ডিলিট শুধুমাত্র Owner ও Manager করতে পারেন।'}</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>SL</th><th>Name</th><th>Office ID</th><th>Office Name</th><th>Designation</th><th>Access</th><th>Contact</th><th>Actions</th></tr></thead>
          <tbody>
            ${data.users.map((u, i) => {
              const a = u.access;
              const aLabel = state.accessLabels[a] || String(a || '').toUpperCase();
              const badgeClass = a === 'owner' ? 'tag-gold' : a === 'manager' ? 'tag-green' : a === 'assistant' ? 'tag-blue' : 'tag-gray';
              const nameJs = esc(u.username).replace(/'/g, "\\'");
              const wa = u.whatsapp ? String(u.whatsapp).replace(/[^0-9]/g, '') : '';
              return `
              <tr>
                <td class="mono" style="font-weight:800;color:var(--text-dim);">${i + 1}</td>
                <td><b>${esc(u.username)}</b></td>
                <td class="mono">${esc(u.office_id)}</td>
                <td>${esc(u.office_name || '—')}</td>
                <td>
                  ${u.role === 'owner' || !canMng
                    ? `<span>${esc(u.designation || '—')}</span>`
                    : `<select class="input" style="width:auto;padding:6px 10px;" onchange="setDesignation(${u.id}, this.value)">
                        ${DESIGNATIONS.length ? designationOptions(u.designation) : `<option>${esc(u.designation || '')}</option>`}
                      </select>`}
                </td>
                <td><span class="tag ${badgeClass}">${esc(aLabel)}</span></td>
                <td>
                  <div class="small">${esc(u.email)}</div>
                  ${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener" class="link-pill" title="WhatsApp-এ যোগাযোগ করুন">💬 ${esc(u.whatsapp)}</a>` : ''}
                </td>
                <td>
                  <div class="flex">
                    <button class="btn btn-ghost btn-sm" onclick="downloadPdf('/api/report/employee/${u.id}?format=csv')">📋 CSV</button>
                    <button class="btn btn-ghost btn-sm" onclick="downloadPdf('/api/report/employee/${u.id}?format=pdf')">📄 Report</button>
                    ${canMng ? `<button class="btn btn-ghost btn-sm" onclick="editUserModal(${u.id}, '${nameJs}')" title="Edit user information">✏️ Info</button>` : ''}
                    ${canMng && u.role !== 'owner' ? `<button class="btn btn-ghost btn-sm" onclick="resetPasswordModal(${u.id}, '${nameJs}')">🔑 Reset</button>` : ''}
                    ${canMng && u.role !== 'owner' ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${nameJs}')" title="Delete user">🗑</button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function approveUser(id, username) {
  try {
    await api('/api/users/' + id + '/approve', { method: 'POST' });
    toast('✅ ' + username + ' — অনুমোদন দেওয়া হয়েছে! এখন লগইন করতে পারবে।', 'success');
    go('team');
  } catch (e) { toast(e.message, 'error'); }
}

async function rejectUser(id, username) {
  if (!confirm('✖ ' + username + ' — রেজিস্ট্রেশনটি রিজেক্ট করবেন?\nরিজেক্ট করলে ব্যবহারকারী লগইন করতে পারবে না।')) return;
  try {
    await api('/api/users/' + id + '/reject', { method: 'POST' });
    toast('✖ ' + username + ' — রেজিস্ট্রেশন রিজেক্ট করা হয়েছে।', 'info');
    go('team');
  } catch (e) { toast(e.message, 'error'); }
}

function editUserModal(id, username) {
  const user = (state.teamUsers || []).find(x => x.id === id) || {};
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>✏️ Edit User Info — ${esc(username)}<button class="close-x" onclick="closeModal()">✕</button></h3>
        <div class="form-group"><label>User Name *</label><input class="input" id="euUsername" value="${esc(user.username || '')}"></div>
        <div class="form-group"><label>Office ID *</label><input class="input" id="euOfficeId" value="${esc(user.office_id || '')}"></div>
        <div class="form-group"><label>Office Name *</label><input class="input" id="euOfficeName" value="${esc(user.office_name || '')}"></div>
        <div class="form-group"><label>Designation *</label>
          <select class="input" id="euDesignation">
            ${DESIGNATIONS.length ? designationOptions(user.designation) : `<option>${esc(user.designation || '')}</option>`}
          </select>
        </div>
        <div class="form-group"><label>Birth Date *</label><input class="input" type="date" id="euBirth" value="${esc(user.birth_date || '')}"></div>
        <div class="form-group"><label>Email *</label><input class="input" type="email" id="euEmail" value="${esc(user.email || '')}"></div>
        <div class="form-group"><label>Phone</label><input class="input" id="euPhone" value="${esc(user.phone || '')}"></div>
        <div class="form-group"><label>WhatsApp Number</label><input class="input" id="euWhatsapp" value="${esc(user.whatsapp || '')}"></div>
        <div class="form-group"><label>Facebook Profile Link</label><input class="input" id="euFb" value="${esc(user.fb_link || '')}"></div>
        <div class="flex">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <span class="spacer"></span>
          <button class="btn btn-gold" onclick="saveUserEdit(${id})">💾 Save Changes</button>
        </div>
      </div>
    </div>`;
}

async function saveUserEdit(id) {
  const body = {
    username: document.getElementById('euUsername').value.trim(),
    office_id: document.getElementById('euOfficeId').value.trim(),
    office_name: document.getElementById('euOfficeName').value.trim(),
    designation: document.getElementById('euDesignation').value,
    birth_date: document.getElementById('euBirth').value,
    email: document.getElementById('euEmail').value.trim(),
    phone: document.getElementById('euPhone').value.trim(),
    whatsapp: document.getElementById('euWhatsapp').value.trim(),
    fb_link: document.getElementById('euFb').value.trim()
  };
  try {
    await api('/api/users/' + id + '/profile', { method: 'PUT', body: JSON.stringify(body) });
    toast('User information updated ✓', 'success');
    closeModal();
    go('team');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteUser(id, username) {
  if (!confirm(`Move user "${username}" to trash? They will be logged out and hidden until restored.`)) return;
  try {
    await api('/api/users/' + id, { method: 'DELETE' });
    toast('User moved to trash', 'success');
    go('team');
  } catch (e) { toast(e.message, 'error'); }
}

async function setDesignation(id, designation) {
  try { await api('/api/users/' + id + '/designation', { method: 'PUT', body: JSON.stringify({ designation }) }); toast('Designation updated', 'success'); go('team'); } catch (e) { toast(e.message, 'error'); go('team'); }
}

function resetPasswordModal(id, username) {
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>🔑 Reset Password — ${esc(username)}<button class="close-x" onclick="closeModal()">✕</button></h3>
        <div class="form-group"><label>New Password</label><input class="input" id="rpPass" type="password" placeholder="Min 6 characters" autocomplete="new-password"></div>
        <div class="form-group"><label>Confirm Password</label><input class="input" id="rpPass2" type="password" placeholder="Type the password again" autocomplete="new-password"></div>
        <div class="flex">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <span class="spacer"></span>
          <button class="btn btn-gold" onclick="saveResetPassword(${id})">💾 Reset Password</button>
        </div>
      </div>
    </div>`;
}

async function saveResetPassword(id) {
  const password = document.getElementById('rpPass').value;
  const confirm = document.getElementById('rpPass2').value;
  if (password.length < 6) return toast('Password must be at least 6 characters.', 'error');
  if (password !== confirm) return toast('Passwords do not match.', 'error');
  try {
    const r = await api('/api/users/' + id + '/password', { method: 'PUT', body: JSON.stringify({ password, confirm }) });
    toast(r.message || 'Password reset ✓', 'success');
    closeModal();
  } catch (e) { toast(e.message, 'error'); }
}

async function setRole(id, role) {
  try { await api('/api/users/' + id + '/role', { method: 'PUT', body: JSON.stringify({ role }) }); toast('Role updated', 'success'); go('team'); } catch (e) { toast(e.message, 'error'); go('team'); }
}

function openForgotModal() {
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>🔑 Forgot Password?<button class="close-x" onclick="closeModal()">✕</button></h3>
        <p class="small mb-14">আপনার পাসওয়ার্ড ভুলে গেলে <b>Office Owner</b>-এর সাথে যোগাযোগ করুন। Owner টিম পেজ থেকে আপনার পাসওয়ার্ড রিসেট করে দিতে পারবে।</p>
        <p class="small mb-14">আপনি লগইন করা অবস্থায় থাকলে <b>Settings → Change My Password</b> দিয়ে নিজেও পরিবর্তন করতে পারবেন।</p>
        <div class="flex">
          <button class="btn btn-gold" onclick="closeModal()">OK</button>
        </div>
      </div>
    </div>`;
}

/* ================= SETTINGS ================= */

async function renderSettings(vc) {
  const u = state.user || {};
  vc.innerHTML = `
    <div class="panel">
      <h3>👤 <span class="em">My Details</span></h3>
      <p class="small mb-14">রেজিস্ট্রেশনের সময় দেওয়া আপনার তথ্য — প্রয়োজন হলে এখান থেকে আবার এডিট করে নিন।</p>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>Full Name <span class="req">*</span></label><input class="input" id="myUsername" type="text" value="${esc(u.username || '')}"></div>
        <div class="form-group" style="flex:1;"><label>Nickname <span class="req">*</span></label><input class="input" id="myNickname" type="text" value="${esc(u.nickname || '')}"></div>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>Office ID <span class="req">*</span></label><input class="input" id="myOfficeId" type="text" value="${esc(u.office_id || '')}"></div>
        <div class="form-group" style="flex:1;"><label>Office Name <span class="req">*</span></label><input class="input" id="myOfficeName" type="text" value="${esc(u.office_name || '')}"></div>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>Email <span class="req">*</span></label><input class="input" id="myEmail" type="email" value="${esc(u.email || '')}"></div>
        <div class="form-group" style="flex:1;"><label>Phone</label><input class="input" id="myPhone" type="text" value="${esc(u.phone || '')}"></div>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>Designation</label><input class="input" type="text" value="${esc(u.designation || '')}" disabled title="Designation পরিবর্তনের জন্য টিম অ্যাডমিনের কাছে বলুন"></div>
        <div class="form-group" style="flex:1;"><label>WhatsApp Number</label><input class="input" id="myWhatsapp" type="text" value="${esc(u.whatsapp || '')}"></div>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>Birth Date <span class="req">*</span></label><input class="input" type="date" id="myBirth" value="${esc(u.birth_date || '')}"></div>
        <div class="form-group" style="flex:1;"><label>Facebook Profile Link</label><input class="input" id="myFb" type="text" value="${esc(u.fb_link || '')}"></div>
      </div>
      <div>
        <button class="btn btn-gold" onclick="saveMyDetails()">💾 Save My Details</button>
      </div>
    </div>
    <div class="panel">
      <h3>🔑 <span class="em">Change My Password</span></h3>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>Current Password</label><input class="input" type="password" id="cpCurrent" autocomplete="current-password"></div>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>New Password</label><input class="input" type="password" id="cpNew" autocomplete="new-password"></div>
        <div class="form-group" style="flex:1;"><label>Confirm New Password</label><input class="input" type="password" id="cpNew2" autocomplete="new-password"></div>
      </div>
      <div>
        <button class="btn btn-gold" onclick="savePasswordChange()">💾 Change Password</button>
      </div>
    </div>
  `;
}

/* ================= TRASH ================= */

const TRASH_ICONS = { content: '🗂️', sponsor: '🤝', notice: '📢', program: '📺', user: '👤' };
const TRASH_LABELS = { content: 'Content', sponsor: 'Sponsor', notice: 'Notice', program: 'Program', user: 'User' };

async function renderTrash(vc) {
  const data = await api('/api/trash');
  const items = data.items.filter(t => t.exists);
  const isManager = canManage();
  vc.innerHTML = `
    <div class="panel">
      <div class="corner-label">🗑️ <span class="em">TRASH LIST</span></div>
      <div class="flex mb-14">
        <p class="small" style="flex:1;">কোন সদস্য কখন কোন কনটেন্ট ডিলিট করেছেন এবং কেন — সব রেকর্ড এখানে অটোমেটিক জমা হয়। যেকোনো সদস্য <b>Restore</b> করতে পারেন। শুধু Owner/Manager "Clear Trash" চাপলে স্থায়ীভাবে মুছে যায়।</p>
        <span class="tag tag-gold">${items.length} item${items.length === 1 ? '' : 's'}</span>
        ${isManager ? `<button class="btn btn-danger" onclick="clearTrash()">🗑️ Clear Trash (${items.length})</button>` : ''}
      </div>
      ${items.length === 0
      ? '<div class="empty">🗑️ TRASH LIST খালি — কেউ এখনো কিছু ডিলিট করেনি।</div>'
      : `<div class="table-wrap">
          <table class="table"><thead><tr>
            <th>SL</th><th>Deleted Time</th><th>Content Headline</th><th>Deleted By</th><th>Remarks</th><th></th>
          </tr></thead><tbody>
            ${items.map((t, i) => `
              <tr>
                <td class="mono" style="font-weight:800;color:var(--text-dim);">${i + 1}</td>
                <td class="nowrap">${esc(fmtLocal(t.deleted_at))}</td>
                <td>
                  <div style="font-weight:700;">${esc(t.label || '—')}</div>
                  <span class="tag tag-gray" style="font-size:10px;">${TRASH_ICONS[t.entity] || '🗑️'} ${TRASH_LABELS[t.entity] || t.entity}</span>
                </td>
                <td><b>${esc(t.deletedByName || ('#' + t.deleted_by))}</b></td>
                <td class="small">${esc(t.remarks || '—')}</td>
                <td style="text-align:right;"><button class="btn btn-ghost btn-sm" onclick="restoreTrashItem(${t.id})">↩️ Restore</button></td>
              </tr>`).join('')}
          </tbody></table>
        </div>`}
    </div>
  `;
}

async function restoreTrashItem(id) {
  if (!confirm('Restore this item?')) return;
  try { await api('/api/trash/restore/' + id, { method: 'POST' }); toast('Restored', 'success'); go('trash'); } catch (e) { toast(e.message, 'error'); }
}

async function clearTrash() {
  if (!confirm('Permanently delete everything in the trash? This cannot be undone.')) return;
  try { const d = await api('/api/trash/clear', { method: 'DELETE' }); toast(`Cleared ${d.cleared} item(s)`, 'success'); go('trash'); } catch (e) { toast(e.message, 'error'); }
}

async function saveMyDetails() {
  const body = {
    username: document.getElementById('myUsername').value,
    nickname: document.getElementById('myNickname').value,
    office_id: document.getElementById('myOfficeId').value,
    office_name: document.getElementById('myOfficeName').value,
    email: document.getElementById('myEmail').value,
    phone: document.getElementById('myPhone').value,
    whatsapp: document.getElementById('myWhatsapp').value,
    fb_link: document.getElementById('myFb').value,
    birth_date: document.getElementById('myBirth').value
  };
  if (!body.username) return toast('Full name is required.', 'error');
  if (!body.nickname) return toast('Nickname is required.', 'error');
  if (!body.office_id) return toast('Office ID is required.', 'error');
  if (!body.office_name) return toast('Office name is required.', 'error');
  if (!body.birth_date) return toast('Birth date is required.', 'error');
  if (!/^\S+@\S+\.\S+$/.test(body.email)) return toast('Valid email required.', 'error');
  try {
    const d = await api('/api/me/profile', { method: 'PUT', body: JSON.stringify(body) });
    state.user = d.user;
    const myDisplay = state.user.nickname || state.user.username;
    document.getElementById('myName').textContent = myDisplay;
    document.getElementById('myAvatar').textContent = (myDisplay[0] || '?').toUpperCase();
    toast('Details saved ✓', 'success');
    if (isBirthdayToday(state.user.birth_date)) {
      toast('🎂 শুভ জন্মদিন, ' + myDisplay + '! 🎉');
      playSound('birthday');
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function savePasswordChange() {
  const current_password = document.getElementById('cpCurrent').value;
  const new_password = document.getElementById('cpNew').value;
  const confirm = document.getElementById('cpNew2').value;
  if (new_password.length < 6) return toast('New password must be at least 6 characters.', 'error');
  if (new_password !== confirm) return toast('Passwords do not match.', 'error');
  try {
    const r = await api('/api/password/change', { method: 'POST', body: JSON.stringify({ current_password, new_password, confirm }) });
    toast(r.message || 'Password changed ✓', 'success');
    document.getElementById('cpCurrent').value = '';
    document.getElementById('cpNew').value = '';
    document.getElementById('cpNew2').value = '';
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= NOTIFICATIONS ================= */

function notifKindIcon(kind) {
  return { deadline: '⏰', notice: '📢', birthday: '🎂', upload: '🎥', registration: '🆕', complete: '🏆' }[kind] || '🔔';
}

function notifKindLabel(kind) {
  return { deadline: 'Deadline', notice: 'Notice', birthday: 'Birthday', upload: 'New Upload', registration: 'New Registration', complete: 'Daily Target Complete' }[kind] || 'Update';
}

function notifClickById(id) {
  const n = (state.notifications || []).find(x => x.id === id);
  if (n) notifClick(n);
}

function notifClick(n) {
  if (n.sponsor_id) { closeModal(); openSponsorDetail(n.sponsor_id); return; }
  if (n.kind === 'notice') { closeModal(); go('notices'); }
  else if (n.kind === 'birthday') { closeModal(); go('team'); }
  else if (n.kind === 'registration') { closeModal(); go('team'); }
  else if (n.kind === 'upload') { openContentDetail(n.ref_id); }
}

async function refreshBell() {
  try {
    const d = await api('/api/notifications');
    const b = document.getElementById('bellBadge');
    if (d.unread > 0) { b.style.display = 'flex'; b.textContent = d.unread > 99 ? '99+' : d.unread; } else { b.style.display = 'none'; }
  } catch (e) {}
}

async function openNotifications() {
  let d;
  try {
    await api('/api/notifications/recheck', { method: 'POST' });
    d = await api('/api/notifications');
  } catch (e) { toast((e && e.message) || 'Notifications load failed', 'error'); return; }
  state.notifications = d.notifications;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>🔔 Notifications
          <span class="flex"><button class="btn btn-ghost btn-sm" onclick="markAllRead()">Mark all read</button>
          <button class="close-x" onclick="closeModal()">✕</button></span>
        </h3>
        ${state.notifications.length === 0 ? '<div class="empty">No notifications yet. All updates — notices, birthdays, deadline alerts, new uploads — will appear here.</div>' : `
        <div class="notif-list">
          ${state.notifications.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'} level-${esc(n.level || 'warn')}" style="cursor:pointer;" onclick="notifClickById(${n.id})" title="Click to open">
              <div>${notifKindIcon(n.kind)} ${esc(n.message)}</div>
              <div class="n-meta">${notifKindLabel(n.kind)}${n.sponsor_name ? ' · ' + esc(n.sponsor_name) : ''} · ${esc(fmtLocal(n.created_at))}</div>
            </div>`).join('')}
        </div>`}
      </div>
    </div>`;
  refreshBell();
}

async function markAllRead() {
  try { await api('/api/notifications/read-all', { method: 'POST' }); }
  catch (e) { toast((e && e.message) || 'Failed to mark read', 'error'); return; }
  closeModal();
  refreshBell();
}

/* ================= SOUND ================= */

let soundCtx = null;

function playSound(kind) {
  if (state.soundOn === false) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!soundCtx) soundCtx = new Ctx();
    if (soundCtx.state === 'suspended') soundCtx.resume();
    const t0 = soundCtx.currentTime;
    const notes = {
      success: [[659, 0], [880, 0.12]],
      notify: [[880, 0], [1174, 0.13]],
      alert: [[880, 0], [660, 0.16], [880, 0.32], [990, 0.48]],
      error: [[220, 0], [180, 0.12], [150, 0.24]],
      reward: [
        [523.25, 0.00], [659.25, 0.10], [783.99, 0.20], [1046.50, 0.30],
        [1046.50, 0.42], [1318.51, 0.54], [1567.98, 0.66], [2093.00, 0.78]
      ],
      notice: [
        [880, 0.00], [587, 0.18], [988, 0.36], [587, 0.54],
        [988, 0.72], [1174, 0.90], [988, 1.08], [1174, 1.26]
      ],
      birthday: [
        [392, 0.00], [392, 0.30], [440, 0.60], [392, 0.90], [523, 1.20], [494, 1.50],
        [392, 1.80], [392, 2.10], [440, 2.40], [392, 2.70], [587, 3.00], [523, 3.30],
        [392, 3.60], [392, 3.90], [659, 4.20], [523, 4.50], [494, 4.80], [440, 5.10],
        [698, 5.40], [698, 5.70], [659, 6.00], [523, 6.30], [587, 6.60], [523, 6.90]
      ]
    };
    const seq = notes[kind] || notes.notify;
    seq.forEach(([f, dt]) => {
      const o = soundCtx.createOscillator();
      const g = soundCtx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const start = t0 + dt;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      o.connect(g).connect(soundCtx.destination);
      o.start(start);
      o.stop(start + 0.32);
    });
  } catch (e) {}
}

function toggleSound() {
  state.soundOn = state.soundOn === false;
  localStorage.setItem('mb-sound', state.soundOn ? 'on' : 'off');
  document.getElementById('soundBtn').textContent = state.soundOn ? '🔊' : '🔇';
  document.getElementById('soundBtn').classList.toggle('muted', state.soundOn === false);
  if (state.soundOn) playSound('notify');
}

/* ================= PROGRAM SCHEDULE ================= */

let programEditId = null;
let programFormOpen = false;

function toggleProgramForm() {
  programFormOpen = !programFormOpen;
  const wrap = document.getElementById('pgFormWrap');
  const btn = document.getElementById('pgToggleBtn');
  if (wrap) wrap.style.display = programFormOpen ? '' : 'none';
  if (btn) btn.textContent = programFormOpen ? '✖ Hide' : '➕ Add Program';
}

function slotLabel(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

function slotTag(c) {
  if (c.slot_label) {
    const ic = c.slot_label === 'UNCUT-CLIP' ? '✂️' : c.slot_label === 'REELS-SHORTS' ? '🎬' : '📌';
    return `<span class="tag tag-blue" style="font-size:10px;">${ic} ${esc(c.slot_label)}</span>`;
  }
  return `<span class="nowrap">${slotLabel(c.upload_time)}</span>`;
}

const BN_DAYS = ['শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার'];
const BN_DAY_ORDER = { 'শনিবার': 0, 'রবিবার': 1, 'সোমবার': 2, 'মঙ্গলবার': 3, 'বুধবার': 4, 'বৃহস্পতিবার': 5, 'শুক্রবার': 6 };

function weekdayName(ymd) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return BN_DAYS[(new Date(y, m - 1, d).getDay() + 1) % 7];
}

function programWeekday(p) {
  if (p && p.weekday) return p.weekday;
  const n = p && p.date ? weekdayName(p.date) : '';
  return n || weekdayName(todayStr());
}

function activeSpecialForDate(date) {
  return (state.special || []).filter(s => s.active === 1 && s.date_from <= date && date <= s.date_to).sort((a, b) => a.slot_time.localeCompare(b.slot_time));
}

function programsForDate(date) {
  const specials = activeSpecialForDate(date);
  if (specials.length) return specials.map(s => ({ slot_time: s.slot_time, title: '🌟 ' + s.title, duration: s.duration }));
  const wd = weekdayName(date);
  return (state.programs || []).filter(p => p && p.slot_time && programWeekday(p) === wd).sort((a, b) => a.slot_time.localeCompare(b.slot_time));
}

function getProgCollapsedDays() {
  try { return JSON.parse(localStorage.getItem('mb_prog_collapsed') || '[]'); } catch (e) { return []; }
}

function toggleProgDay(head) {
  const day = head.getAttribute('data-day');
  let days = getProgCollapsedDays();
  const wasCollapsed = days.includes(day);
  days = wasCollapsed ? days.filter(d => d !== day) : [...days, day];
  localStorage.setItem('mb_prog_collapsed', JSON.stringify(days));
  head.classList.toggle('collapsed', !wasCollapsed);
  const arrow = head.querySelector('.prog-day-arrow');
  if (arrow) arrow.textContent = !wasCollapsed ? '▼' : '▲';
  const body = head.nextElementSibling;
  if (body) body.style.display = wasCollapsed ? '' : 'none';
}

async function renderPrograms(vc) {
  const data = await api('/api/programs');
  state.programs = data.programs;
  state.special = data.special || [];
  const isManager = canManage();
  const edit = programEditId ? state.programs.find(p => p.id === programEditId) : null;
  const today = todayStr();
  const todayName = weekdayName(today);
  const pgDayVal = edit ? programWeekday(edit) : todayName;
  const dayOpts = BN_DAYS.map(d => `<option value="${d}" ${d === pgDayVal ? 'selected' : ''}>${d}</option>`).join('');
  const groups = {};
  for (const p of state.programs) {
    const key = programWeekday(p) || '—';
    (groups[key] = groups[key] || []).push(p);
  }
  const dayKeys = Object.keys(groups).sort((a, b) => (BN_DAY_ORDER[a] ?? 99) - (BN_DAY_ORDER[b] ?? 99));
  const collapsedDays = getProgCollapsedDays();
  const sections = dayKeys.map(day => {
    const list = groups[day].sort((a, b) => a.slot_time.localeCompare(b.slot_time));
    const isCollapsed = collapsedDays.includes(day);
    const rows = list.map(p => `
      <tr>
        <td class="nowrap"><b>${slotLabel(p.slot_time)}</b></td>
        <td><a class="prog-name" href="javascript:void(0)" onclick="showProgramDetails(${p.id})" title="Click to view / copy program details">${esc(p.title)}</a></td>
        <td class="nowrap">${p.duration ? `${p.duration} min` : '<span class="small">—</span>'}</td>
        ${isManager ? `<td style="text-align:right;">
          <button class="btn btn-ghost btn-sm" onclick="startProgramEdit(${p.id})" title="Edit">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProgram(${p.id})" title="Move to trash">🗑</button>
        </td>` : ''}
      </tr>`).join('');
    return `<div class="prog-day">
      <div class="prog-day-head ${isCollapsed ? 'collapsed' : ''}" data-day="${esc(day)}" onclick="toggleProgDay(this)" title="Click to ${isCollapsed ? 'expand' : 'collapse'}">
        <span class="prog-day-badge">📅</span>
        <span class="prog-day-label">${esc(day)}</span>
        ${day === todayName ? `<span class="tag tag-gold">আজ</span>` : ''}
        <span class="small">— ${list.length} টি প্রোগ্রাম</span>
        <span class="prog-day-arrow">${isCollapsed ? '▼' : '▲'}</span>
      </div>
      <div class="prog-day-body" style="display:${isCollapsed ? 'none' : ''};">
        <table class="table"><thead><tr><th>Time</th><th>Program</th><th>Duration</th>${isManager ? '<th style="text-align:right;">Actions</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>`;
  }).join('');
  const specials = (state.special || []).slice().sort((a, b) => (b.date_from || '').localeCompare(a.date_from || '') || a.slot_time.localeCompare(b.slot_time));
  const spEdit = specialEditId ? specials.find(s => s.id === specialEditId) : null;
  const spRows = specials.map(s => `
      <tr>
        <td class="nowrap"><b>${slotLabel(s.slot_time)}</b></td>
        <td><b>${esc(s.title)}</b></td>
        <td class="nowrap">${fmtDate(s.date_from)}${s.date_to !== s.date_from ? ' → ' + fmtDate(s.date_to) : ''}</td>
        <td class="nowrap">${s.duration ? `${s.duration} min` : '<span class="small">—</span>'}</td>
        <td>${s.active === 1 ? '<span class="tag tag-green">✅ Active</span>' : '<span class="tag tag-gray">⏸ Inactive</span>'}${s.date_from <= today && today <= s.date_to ? '<span class="tag tag-gold">আজ</span>' : ''}</td>
        ${isManager ? `<td style="text-align:right;">
          <button class="btn btn-ghost btn-sm" onclick="toggleSpecialActive(${s.id})" title="Activate / Deactivate">${s.active === 1 ? '⏸ Deactivate' : '▶ Activate'}</button>
          <button class="btn btn-ghost btn-sm" onclick="startSpecialEdit(${s.id})" title="Edit">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSpecial(${s.id})" title="Move to trash">🗑</button>
        </td>` : ''}
      </tr>`).join('');
  const specialPanel = `
    <div class="panel">
      <h3>🌟 <span class="em">Special Programs</span> <span class="small">— বিশেষ দিনের (তারিখভিত্তিক) প্রোগ্রাম — একটিভ থাকলে ওই তারিখে এটাই হবে SLOT / LIVE NOW</span>
        ${isManager ? `<button class="btn btn-ghost btn-sm" id="spToggleBtn" style="margin-left:auto;" onclick="toggleSpecialForm()">${specialFormOpen ? '✖ Hide' : '➕ Add Special'}</button>` : ''}
      </h3>
      ${isManager ? `
      <div id="spFormWrap" style="display:${specialFormOpen ? '' : 'none'};">
        <div class="flex mb-14" style="gap:10px; flex-wrap:wrap; align-items:flex-end;">
          <div class="form-group" style="flex:1;min-width:140px;margin-bottom:0;"><label>Date From <span class="req">*</span></label><input class="input" type="date" id="spDateFrom" value="${spEdit ? esc(spEdit.date_from) : today}" onchange="syncSpecialDateTo()"></div>
          <div class="form-group" style="flex:1;min-width:140px;margin-bottom:0;"><label>Date To <span class="small">(টানা দিনের জন্য)</span></label><input class="input" type="date" id="spDateTo" value="${spEdit ? esc(spEdit.date_to) : today}"></div>
          <div class="form-group" style="flex:1;min-width:140px;margin-bottom:0;"><label>Time <span class="req">*</span></label><input class="input" type="time" id="spTime" value="${spEdit ? esc(spEdit.slot_time) : ''}"></div>
          <div class="form-group" style="flex:2;min-width:220px;margin-bottom:0;"><label>Special Program Name <span class="req">*</span></label><input class="input" id="spTitle" type="text" placeholder="যেমন: ঈদ বিশেষ অনুষ্ঠান" value="${spEdit ? esc(spEdit.title) : ''}"></div>
          <div class="form-group" style="flex:1;min-width:100px;margin-bottom:0;"><label>Duration <span class="small">(min)</span></label><input class="input" type="number" id="spDuration" min="0" step="5" value="${spEdit ? esc(spEdit.duration || '') : ''}"></div>
          <div class="form-group" style="margin-bottom:0;">
            ${spEdit ? `<button class="btn btn-ghost" onclick="cancelSpecialEdit()">Cancel</button> ` : ''}
            <button class="btn btn-gold" onclick="saveSpecial()">${spEdit ? '💾 Save' : '➕ Add Special'}</button>
          </div>
        </div>
        <p class="small" style="color:var(--text-dim);margin:0;">একটি বিশেষ প্রোগ্রাম নির্দিষ্ট তারিখে অথবা টানা দিনের (Date From → Date To) জন্য যুক্ত করা যায় — বিশেষ দিন ১০ দিন বা তারও বেশি হতে পারে। একই দিনে একাধিক বিশেষ প্রোগ্রাম যোগ করা যাবে। একটিভ থাকলে ওই তারিখে SLOT ও LIVE NOW-তে নিয়মিত প্রোগ্রামের বদলে এগুলো দেখাবে।</p>
      </div>` : ''}
      ${specials.length === 0
        ? '<div class="empty">কোনো বিশেষ প্রোগ্রাম নেই।</div>'
        : `<div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Special Program</th><th>Date</th><th>Duration</th><th>Status</th>${isManager ? '<th style="text-align:right;">Actions</th>' : ''}</tr></thead><tbody>${spRows}</tbody></table></div>`}
    </div>
  `;
  vc.innerHTML = `
    <div class="panel">
      <h3>📺 <span class="em">Daily Program Schedule</span> <span class="small">— কোন দিন কোন সময় কোন প্রোগ্রাম টিভিতে অন-এয়ার হবে</span>
        ${isManager ? `<button class="btn btn-ghost btn-sm" id="pgToggleBtn" style="margin-left:auto;" onclick="toggleProgramForm()">${programFormOpen ? '✖ Hide' : '➕ Add Program'}</button>` : ''}
      </h3>
      ${isManager ? `
      <div id="pgFormWrap" style="display:${programFormOpen ? '' : 'none'};">
      <div class="flex mb-14" style="gap:10px; flex-wrap:wrap; align-items:flex-end;">
        <div class="form-group" style="flex:1;min-width:150px;margin-bottom:0;"><label>Day <span class="req">*</span></label><select class="input" id="pgDay">${dayOpts}</select></div>
        <div class="form-group" style="flex:1;min-width:150px;margin-bottom:0;"><label>Time <span class="req">*</span></label><input class="input" type="time" id="pgTime" value="${edit ? esc(edit.slot_time) : ''}"></div>
        <div class="form-group" style="flex:2;min-width:240px;margin-bottom:0;"><label>Program Name <span class="req">*</span></label><input class="input" id="pgTitle" type="text" oninput="autoProgTitle()" placeholder="যেমন: সকালের বুলেটিন" value="${edit ? esc(edit.title) : ''}"></div>
        <div class="form-group" style="flex:1;min-width:110px;margin-bottom:0;"><label>Duration <span class="small">(minutes)</span></label><input class="input" type="number" id="pgDuration" min="0" step="5" placeholder="e.g. 30" value="${edit ? esc(edit.duration || '') : ''}"></div>
        <div class="form-group" style="margin-bottom:0;">
          ${edit ? `<button class="btn btn-ghost" onclick="cancelProgramEdit()">Cancel</button> ` : ''}
          <button class="btn btn-gold" onclick="saveProgram()">${edit ? '💾 Save' : '➕ Add'}</button>
        </div>
      </div>
      <div class="prog-cats">
        <div class="prog-cat">
          <div class="prog-cat-head">🎬 <span class="em">FULL PROGRAM CATEGORY</span> <span class="small">— প্রোগ্রামের আপলোড ডিটেইলস</span></div>
          <div class="prog-cat-grid">
            <div class="form-group"><label>Title <span class="small">(Program Name — প্রথম ইনপুট থেকে নিয়ে নিবে)</span></label><input class="input" id="pgProgTitle" oninput="this.dataset.auto='0'" value="${edit ? esc(edit.prog_title) : ''}" ${edit ? '' : 'data-auto="1"'}></div>
            <div class="form-group grow-box"><label>Hashtag, Description & Keywords</label><textarea class="input grow" id="pgProgDesc" rows="1" placeholder="Hashtag, description, keywords — একসাথে লিখুন" oninput="autoGrow(this)">${edit ? esc(edit.prog_desc) : ''}</textarea></div>
            <div class="form-group"><label>YouTube Tag</label><input class="input" id="pgProgTags" value="${edit ? esc(edit.prog_tags) : ''}"></div>
          </div>
        </div>
        <div class="prog-cat">
          <div class="prog-cat-head">🎥 <span class="em">CLIP CATEGORY</span> <span class="small">— প্রোগ্রামের ক্লিপের আপলোড ডিটেইলস</span></div>
          <div class="prog-cat-grid">
            <div class="form-group"><label>Title</label><input class="input" id="pgClipTitle" value="${edit ? esc(edit.clip_title) : ''}"></div>
            <div class="form-group grow-box"><label>Hashtag, Description & Keywords</label><textarea class="input grow" id="pgClipDesc" rows="1" placeholder="Hashtag, description, keywords — একসাথে লিখুন" oninput="autoGrow(this)">${edit ? esc(edit.clip_desc) : ''}</textarea></div>
            <div class="form-group"><label>YouTube Tag</label><input class="input" id="pgClipTags" value="${edit ? esc(edit.clip_tags) : ''}"></div>
          </div>
        </div>
      </div>
      </div>` : ''}
      ${state.programs.length === 0
        ? '<div class="empty">No programs in the schedule yet.' + (isManager ? ' Use "➕ Add Program" to add the first program.' : '') + '</div>'
        : sections}
    </div>
  ` + specialPanel;
  if (edit) { const ft = document.getElementById('pgProgTitle'); if (ft) ft.dataset.auto = '0'; }
  ['pgProgDesc', 'pgClipDesc'].forEach(id => { const ta = document.getElementById(id); if (ta) autoGrow(ta); });
}

function autoGrow(ta) {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.max(44, ta.scrollHeight) + 'px';
}

function startProgramEdit(id) { programEditId = id; programFormOpen = true; go('programs'); }
function cancelProgramEdit() { programEditId = null; go('programs'); }

function autoProgTitle() {
  const t = document.getElementById('pgTitle');
  const ft = document.getElementById('pgProgTitle');
  if (!t || !ft) return;
  if (ft.dataset.auto === '1' || !ft.value.trim()) { ft.value = t.value; ft.dataset.auto = '1'; }
}

async function saveProgram() {
  const slot_time = document.getElementById('pgTime').value;
  const title = document.getElementById('pgTitle').value.trim();
  if (!slot_time) return toast('Please choose a time.', 'error');
  if (!title) return toast('Program name is required.', 'error');
  const weekday = (document.getElementById('pgDay').value || '').trim();
  const dup = (state.programs || []).find(p => p.weekday === weekday && p.slot_time === slot_time && p.id !== programEditId);
  if (dup) {
    shakeApp();
    playSound('error');
    return toast(`"${dup.title}" ইতিমধ্যে ${weekday} ${slotLabel(dup.slot_time)}-এ আছে — একই দিনে একই সময়ে আরেকটি প্রোগ্রাম যোগ করা যাবে না।`, 'error');
  }
  const g = id => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };
  const body = JSON.stringify({
    weekday,
    slot_time,
    title,
    duration: Math.max(0, parseInt(document.getElementById('pgDuration').value, 10) || 0),
    prog_title: g('pgProgTitle') || title,
    prog_desc: g('pgProgDesc'),
    prog_tags: g('pgProgTags'),
    clip_title: g('pgClipTitle'),
    clip_desc: g('pgClipDesc'),
    clip_tags: g('pgClipTags')
  });
  try {
    if (programEditId) {
      await api('/api/programs/' + programEditId, { method: 'PUT', body });
      toast('Program updated ✓', 'success');
    } else {
      await api('/api/programs', { method: 'POST', body });
      toast('Program added ✓', 'success');
    }
    programEditId = null;
    programFormOpen = false;
    refreshLiveNow();
    go('programs');
  } catch (e) { toast(e.message, 'error'); }
}

function progDetRow(label, val, ci) {
  const v = String(val || '').trim();
  return `<div class="det-row">
    <div class="det-label">${esc(label)}</div>
    <div class="det-val">${v ? esc(v) : '<span class="det-empty">— not set</span>'}</div>
    ${v ? `<button class="btn btn-ghost btn-sm copy-btn" data-ci="${ci}" title="Copy ${esc(label)}" onclick="copyTextBtn(this)">📋</button>` : ''}
  </div>`;
}

function progCatBlock(icon, name, items, collect) {
  const filled = items.filter(i => String(i[1] || '').trim());
  const body = filled.length
    ? filled.map(i => {
        const ci = collect ? collect.length : -1;
        if (collect) collect.push({ text: String(i[1]).trim(), label: i[0] });
        return progDetRow(i[0], i[1], ci);
      }).join('')
    : '<div class="det-empty" style="padding:8px 0;">— No details saved yet</div>';
  const allCi = collect ? collect.length : -1;
  if (collect) collect.push({ text: filled.map(i => `${i[0]}: ${String(i[1]).trim()}`).join('\n\n'), label: 'Category details' });
  const allCopy = filled.length
    ? `<button class="btn btn-ghost btn-sm copy-btn" data-ci="${allCi}" title="Copy all" onclick="copyTextBtn(this)">📋 Copy All</button>`
    : '';
  return `<div class="det-cat"><div class="det-cat-head">${icon} ${esc(name)} ${allCopy}</div>${body}</div>`;
}

function copyTextBtn(btn) {
  if (!btn) return;
  const item = (state.progCopyItems || [])[Number(btn.dataset.ci)];
  copyText(item ? item.text : btn.dataset.copy || '', item ? item.label : btn.dataset.label || '', btn);
}

function showProgramDetails(id) {
  const p = state.programs.find(x => x.id === id);
  if (!p) return;
  const copyItems = [];
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal modal-wide">
        <h3>📺 ${esc(p.title)} <span class="tag tag-gold">📅 ${esc(programWeekday(p))}</span> <span class="tag tag-blue">${slotLabel(p.slot_time)}</span>${p.duration ? `<span class="tag tag-gold">⏱ ${p.duration} min</span>` : ''}
          <button class="close-x" onclick="closeModal()">✕</button></h3>
        <p class="small" style="margin-bottom:14px;color:var(--text-dim);">Click 📋 to copy any value — paste directly in your upload.</p>
        <div class="prog-details">
          ${progCatBlock('🎬', 'FULL PROGRAM CATEGORY', [['Title', p.prog_title], ['Hashtag, Description & Keywords', p.prog_desc], ['YouTube Tag', p.prog_tags]], copyItems)}
          ${progCatBlock('🎥', 'CLIP CATEGORY', [['Title', p.clip_title], ['Hashtag, Description & Keywords', p.clip_desc], ['YouTube Tag', p.clip_tags]], copyItems)}
        </div>
      </div>
    </div>`;
  state.progCopyItems = copyItems;
}

async function deleteProgram(id) {
  if (!confirm('Move this program to trash?')) return;
  try { await api('/api/programs/' + id, { method: 'DELETE' }); toast('Moved to trash', 'success'); refreshLiveNow(); go('programs'); } catch (e) { toast(e.message, 'error'); }
}

/* ================= SPECIAL PROGRAMS (frontend) ================= */

let specialEditId = null;
let specialFormOpen = false;

function toggleSpecialForm() {
  specialFormOpen = !specialFormOpen;
  const wrap = document.getElementById('spFormWrap');
  const btn = document.getElementById('spToggleBtn');
  if (wrap) wrap.style.display = specialFormOpen ? '' : 'none';
  if (btn) btn.textContent = specialFormOpen ? '✖ Hide' : '➕ Add Special';
}

function syncSpecialDateTo() {
  const f = document.getElementById('spDateFrom');
  const t = document.getElementById('spDateTo');
  if (!f || !t) return;
  if (t.value && f.value && t.value < f.value) t.value = f.value;
}

function startSpecialEdit(id) { specialEditId = id; specialFormOpen = true; go('programs'); }
function cancelSpecialEdit() { specialEditId = null; go('programs'); }

function specialRangesOverlap(aFrom, aTo, bFrom, bTo) {
  return aFrom <= bTo && bFrom <= aTo;
}

function specialDateLabel(s) {
  return fmtDate(s.date_from) + (s.date_to !== s.date_from ? ' → ' + fmtDate(s.date_to) : '');
}

async function saveSpecial() {
  const title = document.getElementById('spTitle').value.trim();
  const slot_time = document.getElementById('spTime').value;
  const date_from = document.getElementById('spDateFrom').value;
  const date_to = document.getElementById('spDateTo').value || date_from;
  const duration = Math.max(0, parseInt(document.getElementById('spDuration').value, 10) || 0);
  if (!title) return toast('Special program name is required.', 'error');
  if (!slot_time) return toast('Please choose a time.', 'error');
  if (!date_from) {
    shakeApp();
    playSound('error');
    return toast('বিশেষ প্রোগ্রামের তারিখ (Date From) বাধ্যতামূলক!', 'error');
  }
  if (date_to < date_from) {
    shakeApp();
    playSound('error');
    return toast('End date must be on or after start date.', 'error');
  }
  const dup = (state.special || []).find(s => s.id !== specialEditId && s.slot_time === slot_time && specialRangesOverlap(s.date_from, s.date_to, date_from, date_to));
  if (dup) {
    shakeApp();
    playSound('error');
    return toast(`"${dup.title}" ইতিমধ্যে ${specialDateLabel(dup)} তারিখে ${slotLabel(dup.slot_time)}-এ আছে — ওভারল্যাপিং তারিখে একই সময়ে আরেকটি বিশেষ প্রোগ্রাম যোগ করা যাবে না।`, 'error');
  }
  const body = JSON.stringify({ title, slot_time, date_from, date_to, duration });
  try {
    if (specialEditId) {
      await api('/api/programs/special/' + specialEditId, { method: 'PUT', body });
      toast('Special program updated ✓', 'success');
    } else {
      await api('/api/programs/special', { method: 'POST', body });
      toast('Special program added ✓', 'success');
    }
    specialEditId = null;
    specialFormOpen = false;
    refreshLiveNow();
    go('programs');
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleSpecialActive(id) {
  const s = (state.special || []).find(x => x.id === id);
  if (!s) return;
  try {
    await api('/api/programs/special/' + id, { method: 'PUT', body: JSON.stringify({ active: s.active === 1 ? 0 : 1 }) });
    toast(s.active === 1 ? 'বিশেষ প্রোগ্রাম নিষ্ক্রিয় (Inactive) করা হয়েছে' : 'বিশেষ প্রোগ্রাম সক্রিয় (Active) ✓', 'success');
    refreshLiveNow();
    go('programs');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteSpecial(id) {
  if (!confirm('Move this special program to trash?')) return;
  try { await api('/api/programs/special/' + id, { method: 'DELETE' }); toast('Moved to trash', 'success'); refreshLiveNow(); go('programs'); } catch (e) { toast(e.message, 'error'); }
}

/* ================= CLOCK ================= */

function updateClock() {
  const el = document.getElementById('topClock');
  if (!el) return;
  const d = new Date();
  el.innerHTML = `<span class="tc-time">${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span class="tc-date">${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>`;
}

/* ================= WEATHER ================= */

const WEATHER_CODES = {
  0: ['☀️', 'Clear'],
  1: ['🌤️', 'Mostly clear'],
  2: ['⛅', 'Partly cloudy'],
  3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Foggy'],
  48: ['🌫️', 'Icy fog'],
  51: ['🌦️', 'Light drizzle'],
  53: ['🌦️', 'Drizzle'],
  55: ['🌦️', 'Dense drizzle'],
  56: ['🌧️', 'Freezing drizzle'],
  57: ['🌧️', 'Freezing drizzle'],
  61: ['🌧️', 'Light rain'],
  63: ['🌧️', 'Rain'],
  65: ['🌧️', 'Heavy rain'],
  66: ['🌧️', 'Freezing rain'],
  67: ['🌧️', 'Freezing rain'],
  71: ['🌨️', 'Light snow'],
  73: ['🌨️', 'Snow'],
  75: ['❄️', 'Heavy snow'],
  77: ['🌨️', 'Snow grains'],
  80: ['🌦️', 'Light showers'],
  81: ['🌧️', 'Showers'],
  82: ['⛈️', 'Heavy showers'],
  85: ['🌨️', 'Snow showers'],
  86: ['🌨️', 'Heavy snow showers'],
  95: ['⛈️', 'Thunderstorm'],
  96: ['⛈️', 'Thunderstorm with hail'],
  99: ['⛈️', 'Thunderstorm with hail']
};

const FALLBACK_LOC = { lat: 23.8103, lon: 90.4125, name: 'Dhaka' };

function getWeatherLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(FALLBACK_LOC);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(FALLBACK_LOC),
      { timeout: 6000, maximumAge: 600000 }
    );
  });
}

const WEATHER_CACHE_KEY = 'mb-weather-cache';

function weatherCacheLoad() {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.html) return null;
    return c;
  } catch (e) { return null; }
}

function weatherCacheSave(html, t) {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ html, t: t || Date.now() }));
  } catch (e) {}
}

async function fetchWeather() {
  const el = document.getElementById('topWeather');
  if (!el) return;
  const cached = weatherCacheLoad();
  if (cached) {
    el.innerHTML = cached.html;
  } else {
    el.innerHTML = `<span class="w-temp">--</span><span class="w-meta">Weather…</span>`;
  }
  try {
    const loc = await getWeatherLocation();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('weather unavailable');
    const j = await r.json();
    const c = j.current || {};
    const wc = WEATHER_CODES[c.weather_code] || ['🌡️', 'Weather'];
    const tzCity = String(j.timezone || '').split('/').pop().replace(/_/g, ' ');
    const city = loc.name || tzCity || '';
    const html = `<span class="w-ico">${wc[0]}</span><span class="w-temp">${Math.round(c.temperature_2m)}°</span><span class="w-meta"><span>${wc[1]}${city ? ' · ' + esc(city) : ''}</span><span class="w-sub">feels ${Math.round(c.apparent_temperature)}° · 💧 ${c.relative_humidity_2m}% · 🌬 ${c.wind_speed_10m} km/h</span></span>`;
    el.innerHTML = html;
    weatherCacheSave(html);
  } catch (e) {
    if (!cached) el.innerHTML = `<span class="w-temp">--</span><span class="w-meta">Weather unavailable</span>`;
  }
}

/* ================= NEWS TICKER ================= */

function newsTickerHtml() {
  return `
    <div class="news-ticker" id="newsTicker" style="display:none;">
      <div class="news-ticker-badge"><span class="news-live-dot"></span>LIVE NEWS</div>
      <div class="news-ticker-viewport"><div class="news-ticker-track"></div></div>
    </div>`;
}

function appFooterHtml() {
  return `
    <div class="app-footer"><span class="f-brand">MICROBOSS™</span><span class="f-helpline">Created by <a href="https://www.facebook.com/mehexad" target="_blank" rel="noopener">Mehezad Galib Siam</a> | Follow our Facebook Page: <a href="https://www.facebook.com/microboss" target="_blank" rel="noopener">facebook.com/microboss</a> | Any Query and Support (Microboss Helpline): <a href="mailto:mehexad@gmail.com">mehexad@gmail.com</a> | WhatsApp: <a href="https://wa.me/8801677012723" target="_blank" rel="noopener">+8801677012723</a></span></div>`;
}

async function loadNewsTicker() {
  const ticker = document.getElementById('newsTicker');
  if (!ticker) return;
  const cached = readNewsCache();
  if (cached && cached.length) renderNewsTicker(cached);
  let items = [];
  try {
    const d = await api('/api/news');
    items = d.headlines || [];
  } catch (e) { items = []; }
  if (!items.length) {
    if (!cached || !cached.length) ticker.style.display = 'none';
    return;
  }
  writeNewsCache(items);
  renderNewsTicker(items);
}

function renderNewsTicker(items) {
  const ticker = document.getElementById('newsTicker');
  if (!ticker || !items.length) return;
  ticker.style.display = 'flex';
  const logoHtml = `<span class="news-item-logo">${MB_LOGO}</span>`;
  const html = items.map(h => `<a class="news-item" href="${esc(h.link)}" target="_blank" rel="noopener" title="View details — ${esc(h.source)}">${esc(h.title)}<span class="news-src">[${esc(h.source)}]</span></a>${logoHtml}`).join('');
  const track = ticker.querySelector('.news-ticker-track');
  if (track) {
    const durS = Math.max(60, items.length * 9);
    const durMs = durS * 1000;
    track.innerHTML = html + html;
    track.style.animationDuration = durS + 's';
    track.style.animationDelay = '-' + (newsTickerResumeOffset(durMs, items) / 1000) + 's';
  }
}

function readNewsCache() {
  try {
    const c = JSON.parse(localStorage.getItem('mb-news-cache') || 'null');
    if (c && Array.isArray(c.items) && c.items.length && Date.now() - c.at < 30 * 60 * 1000) return c.items;
  } catch (e) {}
  return null;
}

function writeNewsCache(items) {
  try { localStorage.setItem('mb-news-cache', JSON.stringify({ at: Date.now(), items })); } catch (e) {}
}

let newsTickerState = null;

function newsTickerResumeOffset(durMs, items) {
  let st = newsTickerState;
  if (!st) {
    try { st = JSON.parse(localStorage.getItem('mb-news-state') || 'null'); } catch (e) { st = null; }
  }
  const sig = items.slice(0, 5).map(h => h.title).join('|');
  const prevSig = st && st.sig ? st.sig : '';
  let clock = st && st.clock ? st.clock : 0;
  if (!clock || sig !== prevSig) {
    clock = Date.now();
  }
  newsTickerState = { clock, sig };
  try { localStorage.setItem('mb-news-state', JSON.stringify(newsTickerState)); } catch (e) {}
  return (Date.now() - clock) % Math.max(1, durMs);
}

/* ================= YOUTUBE UPLOAD TRACK ================= */

function relTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hour' + (Math.floor(diff / 3600) > 1 ? 's' : '') + ' ago';
  if (diff < 172800) return 'yesterday';
  return fmtDate(iso.slice(0, 10));
}

async function renderOneEye(vc) {
  const isManager = canManage();
  let sources = [];
  try {
    const d = await api('/api/oneeye');
    sources = d.sources || [];
  } catch (e) {
    vc.innerHTML = `<div class="panel"><div class="empty">Could not load Youtube Upload Track data.</div></div>`;
    return;
  }
  const cards = sources.length
    ? sources.map(s => oeCardHtml(s, isManager)).join('')
    : `<div class="empty">No channels tracked yet.${isManager ? ' Add a YouTube channel URL above to start tracking its latest upload.' : ''}</div>`;

  vc.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>Youtube Upload Track 👁 <span class="small">Live tracking — latest uploads from your YouTube channels</span></h3>
          <p class="small">Every channel shows its most recent video. Cards refresh automatically every 2 minutes.</p>
        </div>
        ${isManager ? `<button class="btn btn-ghost oe-toggle" id="oeToggle" onclick="toggleOeAdd()">${oeAddHidden() ? 'Show Input Box' : 'Hide Input Box'}</button>` : ''}
      </div>
      ${isManager ? `
      <div class="oe-add" id="oeAdd" style="${oeAddHidden() ? 'display:none;' : ''}">
        <input class="input" id="oeName" placeholder="Channel name (e.g. প্রথম আলো)">
        <input class="input" id="oeUrl" placeholder="YouTube channel URL — youtube.com/@handle or /channel/UC...">
        <button class="btn btn-gold" onclick="oneEyeAddSource()">＋ Add Channel</button>
      </div>` : ''}
      <div class="oe-grid" id="oeGrid">${cards}</div>
    </div>`;
}

function oeThumbHtml(l) {
  if (!l || !l.link) return `<div class="oe-thumb oe-thumb-off"><span class="oe-play">▶</span></div>`;
  return `<a class="oe-thumb" href="${esc(l.link)}" target="_blank" rel="noopener" title="Watch on YouTube">
    <img src="${esc(l.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">
    <span class="oe-play">▶</span>
  </a>`;
}

function oeBodyHtml(l) {
  if (l && l.title) return `<div class="oe-title">${esc(l.title)}</div><div class="oe-time">⏱ ${relTime(l.published)}</div>`;
  return `<div class="oe-title oe-err">${esc((l && l.error) || 'No upload found yet.')}</div>`;
}

function oeCardInner(s, isManager) {
  return `<div class="oe-head"><span class="oe-name">${esc(s.name)}</span><span class="oe-kind">YouTube</span></div>
    ${oeThumbHtml(s.latest)}
    <div class="oe-body">${oeBodyHtml(s.latest)}</div>
    ${isManager ? `<button class="oe-del" title="Remove source" onclick="oneEyeRemoveSource(${s.id})">✕</button>` : ''}`;
}

function oeCardHtml(s, isManager) {
  return `<div class="oe-card" data-id="${s.id}">${oeCardInner(s, isManager)}</div>`;
}

async function refreshOneEye() {
  if (state.view !== 'oneeye') return;
  const vc = document.getElementById('viewContainer');
  if (!vc) return;
  const grid = document.getElementById('oeGrid');
  if (!grid) { await renderOneEye(vc); return; }
  let sources = [];
  try { sources = (await api('/api/oneeye')).sources || []; } catch (e) { return; }
  const ids = new Set(sources.map(s => s.id));
  const isManager = canManage();
  for (const card of [...grid.querySelectorAll('.oe-card')]) {
    if (!ids.has(Number(card.dataset.id))) {
      card.classList.add('oe-out');
      card.addEventListener('animationend', () => card.remove(), { once: true });
      setTimeout(() => { if (card.parentNode) card.remove(); }, 800);
    }
  }
  for (const s of sources) {
    let card = grid.querySelector(`.oe-card[data-id="${s.id}"]`);
    if (card) {
      card.innerHTML = oeCardInner(s, isManager);
    } else {
      card = document.createElement('div');
      card.className = 'oe-card oe-in';
      card.dataset.id = s.id;
      card.innerHTML = oeCardInner(s, isManager);
      grid.appendChild(card);
    }
  }
  if (!sources.length && !grid.querySelector('.oe-card')) {
    grid.innerHTML = `<div class="empty">No channels tracked yet.${isManager ? ' Add a YouTube channel URL above to start tracking its latest upload.' : ''}</div>`;
  }
}

function oeAddHidden() {
  try { return localStorage.getItem('mb-oe-add-hidden') === '1'; } catch (e) { return false; }
}

function toggleOeAdd() {
  const hidden = !oeAddHidden();
  try { localStorage.setItem('mb-oe-add-hidden', hidden ? '1' : '0'); } catch (e) {}
  const box = document.getElementById('oeAdd');
  const btn = document.getElementById('oeToggle');
  if (box) box.style.display = hidden ? 'none' : 'flex';
  if (btn) btn.textContent = hidden ? 'Show Input Box' : 'Hide Input Box';
}

async function oneEyeAddSource() {
  const name = document.getElementById('oeName').value.trim();
  const url = document.getElementById('oeUrl').value.trim();
  if (!name) return toast('Channel name is required.', 'error');
  if (!url) return toast('YouTube channel URL is required.', 'error');
  try {
    const r = await api('/api/oneeye', { method: 'POST', body: JSON.stringify({ name, url }) });
    toast('Channel added: ' + r.source.name, 'success');
    refreshOneEye();
  } catch (e) { toast(e.message, 'error'); }
}

async function oneEyeRemoveSource(id) {
  if (!confirm('Remove this channel from Youtube Upload Track?')) return;
  try {
    await api('/api/oneeye/' + id, { method: 'DELETE' });
    toast('Channel removed.', 'success');
    refreshOneEye();
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= LIVE NOW ================= */

const MB_LOGO = `<svg width="18" height="18" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#FFC709"/><text x="16" y="22" font-size="17" font-family="Arial Black, Arial, sans-serif" font-weight="900" text-anchor="middle" fill="#0A1628">M</text></svg>`;

function hhmm(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function toMins(s) {
  const [h, m] = String(s).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function updateLiveNow() {
  const el = document.getElementById('liveNow');
  if (!el) return;
  const today = todayStr();
  const list = programsForDate(today);
  const cur = new Date().getHours() * 60 + new Date().getMinutes();
  const endOf = (p, i) => p.duration ? toMins(p.slot_time) + Number(p.duration) : (i + 1 < list.length ? toMins(list[i + 1].slot_time) : 24 * 60);
  let current = null, currentIdx = -1, currentEnd = 0;
  for (let i = 0; i < list.length; i++) {
    const start = toMins(list[i].slot_time);
    const end = endOf(list[i], i);
    if (start <= cur && cur < end) { current = list[i]; currentIdx = i; currentEnd = end; break; }
  }
  let next = null;
  if (current) {
    for (let i = 0; i < list.length; i++) {
      if (i !== currentIdx && toMins(list[i].slot_time) >= currentEnd) { next = list[i]; break; }
    }
  } else {
    for (let i = 0; i < list.length; i++) {
      if (toMins(list[i].slot_time) > cur) { next = list[i]; break; }
    }
  }
  el.innerHTML = `
    <div class="ln-row ln-live"><span class="ln-dot"></span>LIVE NOW</div>
    <div class="ln-name">${current ? slotLabel(current.slot_time) + ' — ' + esc(current.title) : '— Off Air'}</div>
    <div class="ln-row ln-next">COMING UP NEXT</div>
    <div class="ln-name ln-next-name">${next ? slotLabel(next.slot_time) + ' — ' + esc(next.title) : '—'}</div>
  `;
}

async function refreshLiveNow() {
  try { const data = await api('/api/programs'); state.programs = data.programs; state.special = data.special || []; } catch (e) { return; }
  updateLiveNow();
}

/* ================= LIVE WORKFLOW TRACKING ================= */

let activityItems = [];
let activityTimer = null;
let lastActivityId = 0;

function platformLabel(p) {
  return (PLATFORMS.find(x => x.key === p) || {}).label || p;
}

function liveTime(a) {
  const now = new Date();
  if (a.upload_date === todayStr()) {
    const [h, m] = (a.upload_time || '00:00').split(':').map(Number);
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const mins = Math.max(0, Math.round((now - t) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    return `today ${a.upload_time}`;
  }
  return `${fmtDate(a.upload_date)} ${a.upload_time}`;
}

function liveFeedItemsHtml(items, highlightNew) {
  return items.slice(0, 2).map((a, i) => `
    <div class="live-item${highlightNew && i === 0 ? ' flash' : ''}">
      <div class="live-avatar">${esc((a.uploaded_by_name || '?')[0].toUpperCase())}</div>
      <div class="live-body">
        <div class="live-head"><b>${esc(a.uploaded_by_name)}</b>${a.uploaded_by_designation ? `<span class="small">${esc(a.uploaded_by_designation)}</span>` : ''}</div>
        <div class="live-headline">${esc(a.headline || a.slug || '—')}</div>
        <div class="live-platforms">${a.platforms.length ? a.platforms.map(p => `<span class="pf-chip">${esc(platformLabel(p))}</span>`).join('') : '<span class="small">no platform</span>'}</div>
      </div>
      <div class="live-time">${esc(liveTime(a))}</div>
    </div>`).join('');
}

function livePanelHtml() {
  if (!activityItems.length) return '';
  return `
    <div class="panel live-panel" id="livePanel">
      <h3>⚡ <span class="em">Live Workflow Tracking</span> <span class="live-dot"></span> <span class="small">Team uploads as they happen</span></h3>
      <div class="live-feed" id="liveFeed">${liveFeedItemsHtml(activityItems, false)}</div>
    </div>`;
}

function renderLivePanel(highlightNew) {
  if (state.view !== 'dashboard') return;
  const anchor = document.getElementById('liveAnchor');
  let panel = document.getElementById('livePanel');
  if (!activityItems.length) {
    if (panel) panel.remove();
    return;
  }
  if (!panel && anchor) {
    const d = document.createElement('div');
    d.innerHTML = livePanelHtml();
    panel = d.firstElementChild;
    anchor.after(panel);
  }
  const feed = document.getElementById('liveFeed');
  if (feed) feed.innerHTML = liveFeedItemsHtml(activityItems, !!highlightNew);
}

async function pollActivity() {
  try {
    const d = await api('/api/activity?limit=12');
    const fresh = d.items || [];
    const sig = fresh.map(x => x.id).join(',');
    const prevSig = activityItems.map(x => x.id).join(',');
    let isNew = false;
    if (activityItems.length > 0 && fresh.length > 0 && fresh[0].id > lastActivityId) {
      const newest = fresh[0];
      if (!state.user || newest.uploaded_by !== state.user.id) {
        const plats = newest.platforms.length ? newest.platforms.map(platformLabel).join(', ') : 'no platform';
        toast(`📤 ${newest.uploaded_by_name} uploaded — ${plats}`, 'info');
        playSound('notify');
        isNew = true;
      }
    }
    if (fresh.length) lastActivityId = fresh[0].id;
    activityItems = fresh;
    if (sig !== prevSig) renderLivePanel(isNew);
  } catch (e) {}
}

function startLiveActivity() {
  pollActivity();
}

/* ================= NOTICES ================= */

let lastNoticeId = 0;
let noticesSeenInit = false;

function timeLeft(exp) {
  const ms = exp - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

function noticeMetaHtml(n) {
  const posted = n.created_at ? new Date(n.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const exp = n.expires_at ? new Date(n.expires_at) : null;
  const desig = n.designation ? ` · <span class="tag tag-blue" style="font-size:10px;">${esc(n.designation)}</span>` : '';
  return `📢 ${esc(n.poster_name || n.poster || 'Manager')}${desig}${n.phone ? ' · 📱 ' + esc(n.phone) : ''}${n.email ? ' · ✉️ ' + esc(n.email) : ''}<br>Posted ${esc(posted)}${exp ? ' · ⏳ ' + esc(timeLeft(exp)) : ''}`;
}

function noticesBannersHtml(notices) {
  if (!notices || !notices.length) return '';
  return notices.map(n => `
    <div class="notice-banner" style="cursor:pointer;" onclick="viewNotice(${n.id})" title="Click to view full notice">
      <span class="nb-ic">📢</span>
      <div style="min-width:0;">
        <div class="nb-msg">${esc(n.message)}</div>
        <div class="nb-meta">${noticeMetaHtml(n)}</div>
      </div>
      <div class="nb-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); viewNotice(${n.id})">View</button>
      </div>
    </div>`).join('');
}

function viewNotice(id) {
  const n = (state.notices || []).find(x => x.id === id);
  if (!n) return;
  const exp = n.expires_at ? new Date(n.expires_at) : null;
  const expired = exp && exp <= new Date();
  const canDel = canManage() || (state.user && n.created_by === state.user.id);
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal modal-wide">
        <h3>📢 <span class="em">Notice</span> <button class="close-x" onclick="closeModal()">✕</button></h3>
        <div class="notice-card" style="border:none;background:transparent;padding:0;">
          <div class="nb-msg" style="font-size:18px;line-height:1.8;">${esc(n.message)}</div>
          <div class="nb-meta" style="font-size:14px;">
            📢 <b>${esc(n.poster_name || n.poster || 'Manager')}</b>
            ${n.designation ? `<span class="tag tag-blue" style="font-size:11px;">${esc(n.designation)}</span>` : ''}
            ${n.phone ? ' · 📱 ' + esc(n.phone) : ''}
            ${n.email ? ' · ✉️ ' + esc(n.email) : ''}
            <br>
            Posted ${esc(new Date(n.created_at).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}
            · <b>${n.days} day(s)</b> · ${exp ? (expired ? '⛔ expired' : '⏳ ' + timeLeft(exp)) : ''}
          </div>
        </div>
        <div class="flex mt-14">
          <span class="spacer"></span>
          ${canDel ? `<button class="btn btn-ghost" onclick="deleteNotice(${n.id})">🗑 Delete</button>` : ''}
          <button class="btn btn-gold" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>`;
}

function refreshNoticesOnDashboard() {
  const el = document.getElementById('noticeArea');
  if (el) el.innerHTML = noticesBannersHtml(state.notices);
}

async function fetchNotices() {
  try {
    const d = await api('/api/notices');
    const fresh = d.notices || [];
    if (noticesSeenInit && fresh.length && fresh[0].id > lastNoticeId) {
      const n = fresh[0];
      toast(`📢 New notice: ${n.message.slice(0, 80)}${n.message.length > 80 ? '…' : ''}`, 'info');
      playSound('notice');
    }
    noticesSeenInit = true;
    if (fresh.length) lastNoticeId = fresh[0].id;
    const changed = JSON.stringify(state.notices) !== JSON.stringify(fresh);
    state.notices = fresh;
    if (changed) refreshNoticesOnDashboard();
    return fresh;
  } catch (e) { return state.notices || []; }
}

let noticesPollTimer = null;

function startNoticesPoll() {
  fetchNotices();
}

function noticeCardHtml(n) {
  const canDel = canManage() || (state.user && n.created_by === state.user.id);
  const exp = n.expires_at ? new Date(n.expires_at) : null;
  const expired = exp && exp <= new Date();
  return `
    <div class="notice-card">
      <div class="nb-msg">${esc(n.message)}</div>
      <div class="nb-meta">
        📢 <b>${esc(n.poster_name || n.poster || 'Manager')}</b>
        ${n.designation ? `<span class="tag tag-blue" style="font-size:10px;">${esc(n.designation)}</span>` : ''}
        ${n.department ? `<span class="tag tag-green" style="font-size:10px;">🏢 ${esc(n.department)}</span>` : ''}
        ${n.phone ? ' · 📱 ' + esc(n.phone) : ''}
        ${n.email ? ' · ✉️ ' + esc(n.email) : ''}
        <br>
        Posted ${esc(new Date(n.created_at).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}
        · <b>${n.days} day(s)</b> · ${exp ? (expired ? '⛔ expired' : '⏳ ' + timeLeft(exp)) : ''}
      </div>
      ${canDel ? `<div class="flex mt-14"><span class="spacer"></span><button class="btn btn-ghost btn-sm" onclick="deleteNotice(${n.id})">🗑 Delete</button></div>` : ''}
    </div>`;
}

async function renderNotices(vc) {
  const active = await fetchNotices();
  let all = active;
  try { all = (await api('/api/notices/all')).notices || []; } catch (e) {}
  const recent = all.filter(n => !active.some(a => a.id === n.id));
  vc.innerHTML = `
    ${canManage() ? `
    <div class="panel">
      <h3>📢 <span class="em">Post a Notice</span> <span class="small">— visible to the whole team</span></h3>
      <div class="form-group mb-14"><label>Notice Message <span class="req">*</span></label>
        <textarea class="input" id="ncMsg" rows="3" placeholder="Write the notice for the whole team…"></textarea>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>Your Name <span class="req">*</span></label>
          <input class="input" id="ncName" value="${esc(state.user.username)}"></div>
        <div class="form-group" style="flex:1;"><label>Designation <span class="req">*</span></label>
          <input class="input" id="ncDesignation" value="${esc(state.user.designation || '')}" placeholder="অফিসের পদবি"></div>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>Mobile Number</label>
          <input class="input" id="ncPhone" placeholder="+880 1XXX-XXXXXX" value="${esc(state.user.phone || '')}"></div>
        <div class="form-group" style="flex:1;"><label>Email</label>
          <input class="input" id="ncEmail" placeholder="you@example.com" value="${esc(state.user.email || '')}"></div>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1;"><label>Department <span class="req">*</span></label>
          <input class="input" id="ncDepartment" placeholder="যে বিভাগ থেকে নোটিশ দেওয়া হচ্ছে (যেমন: News Room)"></div>
        <div class="form-group" style="flex:1;"><label>Show on Dashboard for</label>
          <select class="input" id="ncDays">
            ${[1, 2, 3, 5, 7, 14, 30].map(d => `<option value="${d}" ${d === 7 ? 'selected' : ''}>${d} day${d > 1 ? 's' : ''}</option>`).join('')}
          </select></div>
      </div>
      <button class="btn btn-gold" onclick="postNotice()">📢 Post Notice</button>
    </div>` : ''}
    <div class="panel">
      <h3>📢 <span class="em">Active Notices</span></h3>
      ${active.length === 0 ? '<div class="empty">No active notices right now.</div>' : active.map(noticeCardHtml).join('')}
    </div>
    ${recent.length ? `
    <div class="panel">
      <h3>🕘 <span class="em">Recent Notices</span></h3>
      ${recent.map(noticeCardHtml).join('')}
    </div>` : ''}
  `;
}

async function postNotice() {
  const message = document.getElementById('ncMsg').value.trim();
  const poster_name = document.getElementById('ncName').value.trim();
  const designation = document.getElementById('ncDesignation').value.trim();
  const department = document.getElementById('ncDepartment').value.trim();
  const phone = document.getElementById('ncPhone').value.trim();
  const email = document.getElementById('ncEmail').value.trim();
  const days = Number(document.getElementById('ncDays').value);
  if (!message) return toast('Write a notice message.', 'error');
  if (!poster_name) return toast('Enter your name.', 'error');
  if (!designation) return toast('নোটিশ দিচ্ছেন এমন অফিস ব্যক্তির Designation লিখুন।', 'error');
  if (!department) return toast('Department লিখুন।', 'error');
  try {
    await api('/api/notices', { method: 'POST', body: JSON.stringify({ message, poster_name, designation, department, phone, email, days }) });
    toast('Notice posted ✓', 'success');
    playSound('success');
    lastNoticeId = 0; noticesSeenInit = false;
    go('notices');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteNotice(id) {
  try {
    await api('/api/notices/' + id, { method: 'DELETE' });
    toast('Notice moved to trash ✓', 'success');
    playSound('success');
    go('notices');
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= COMMON CAPTION ================= */

let captionsState = { all: [], ministers: [], parties: [], filter: 'All', partyFilter: null };

async function renderCaptions(vc) {
  try {
    const [d, md, pd] = await Promise.all([api('/api/captions'), api('/api/ministers'), api('/api/parties')]);
    captionsState.all = d.captions || [];
    captionsState.ministers = md.ministers || [];
    captionsState.parties = pd.parties || [];
  } catch (e) {
    vc.innerHTML = `<div class="panel"><div class="empty">Could not load captions.</div></div>`;
    return;
  }
  try {
    const cf = JSON.parse(localStorage.getItem('mb_captions_prefs') || '{}');
    if (cf.filter) captionsState.filter = cf.filter;
    if (cf.partyFilter) captionsState.partyFilter = cf.partyFilter;
  } catch (e) {}
  const cats = [...new Set(captionsState.all.map(c => c.category))].sort((a, b) => a.localeCompare(b));
  const f = captionsState.filter;
  if (!(f === 'All' || f === 'Ministry' || f === 'Group' || f.startsWith('minister:') || cats.includes(f))) captionsState.filter = 'All';
  const filter = captionsState.filter;
  const specialCats = ['Prime Minister', 'মির্জা ফখরুল ইসলাম আলমগীর'];
  const catChips = cats.filter(c => c !== 'Minister').map(c => ({ key: c, label: c }));
  const chips = [
    { key: 'All', label: 'ALL' },
    { key: 'Group', label: 'POLITICAL PARTY' },
    ...specialCats.filter(c => cats.includes(c)).map(c => ({ key: c, label: c })),
    { key: 'Ministry', label: 'MINISTRY' },
    ...captionsState.ministers.map(m => ({ key: 'minister:' + m.name, label: m.name })),
    ...catChips.filter(c => !specialCats.includes(c.key)),
  ];
  const expanded = chipsExpanded();
  let content;
  if (filter === 'Ministry') {
    content = ministryGridHtml();
  } else if (filter === 'Group') {
    if (!captionsState.parties.some(p => p.name === captionsState.partyFilter)) captionsState.partyFilter = captionsState.parties.length ? captionsState.parties[0].name : null;
    content = partyGroupHtml();
  } else if (filter.startsWith('minister:')) {
    const name = filter.slice('minister:'.length);
    const list = captionsState.all.filter(c => c.minister_name === name);
    content = list.length ? `<h4 class="cap-cat">👤 ${esc(name)} <span class="small">(${list.length})</span></h4>` + capListHtml(list) : `<div class="empty">এই মন্ত্রীর জন্য এখনো কোনো ক্যাপশন নেই।</div>`;
  } else if (filter === 'All') {
    const grouped = {};
    for (const c of captionsState.all) (grouped[c.category] = grouped[c.category] || []).push(c);
    content = Object.keys(grouped).length === 0 ? `<div class="empty">No captions here yet.${canManage() ? ' Add one above.' : ''}</div>` : Object.entries(grouped).map(([cat, list]) => capGroupHtml(cat, list)).join('');
  } else {
    const list = captionsState.all.filter(c => c.category === filter);
    content = list.length ? capGroupHtml(filter, list) : `<div class="empty">No captions here yet.${canManage() ? ' Add one above.' : ''}</div>`;
  }
  vc.innerHTML = `
    ${canManage() ? `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>💬 <span class="em">LIVE TITLE</span> <span class="small">— ready-made live captions for OBS Studio / vMix / Wirecast</span></h3>
          <p class="small">Facebook ও YouTube লাইভে ব্যবহারের জন্য ক্যাপশনগুলো কপি করে নিন। ক্যাটাগরি অনুযায়ী নতুন ক্যাপশন যোগ করুন।</p>
        </div>
        <button class="btn btn-ghost oe-toggle" id="capToggle" onclick="toggleCapAdd()">${capAddHidden() ? 'Show Input Box' : 'Hide Input Box'}</button>
      </div>
      <div id="capAddBox" style="${capAddHidden() ? 'display:none;' : ''}">
      <div class="flex mb-14">
        <div class="form-group" style="flex:1; min-width:180px;"><label>Category</label>
          <input class="input" id="capCategory" list="capCats" placeholder="যেমন: Breaking News">
          <datalist id="capCats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        </div>
        <div class="form-group cap-caption-input" style="flex:2; min-width:220px;">
          <label>Caption Text <button class="cap-copy-inline" onclick="copyCaptionInput('capText')">📋</button></label>
          <textarea class="input cap-auto" id="capText" rows="1" placeholder="লাইভের ক্যাপশন লিখুন…" oninput="autoGrow(this)"></textarea>
        </div>
      </div>
      <div class="form-group mb-14">
        <label>Description <button class="cap-copy-inline" onclick="copyCaptionInput('capDesc')">📋</button></label>
        <textarea class="input cap-auto" id="capDesc" rows="2" placeholder="লাইভের ডেসক্রিপশন লিখুন… (বক্স নিজে নিজে বড়/ছোট হবে)" oninput="autoGrow(this)"></textarea>
      </div>
      <div class="flex mb-14">
        <div class="form-group" style="flex:1; min-width:150px;">
          <label>Hashtag <button class="cap-copy-inline" onclick="copyCaptionInput('capHashtag')">📋</button></label>
          <input class="input" id="capHashtag" placeholder="স্পেস দিয়ে আলাদা করুন — যেমন: #Live #News">
        </div>
        <div class="form-group" style="flex:1; min-width:150px;">
          <label>Keywords <button class="cap-copy-inline" onclick="copyCaptionInput('capKeywords')">📋</button></label>
          <input class="input" id="capKeywords" placeholder="| দিয়ে আলাদা করুন — যেমন: breaking | news">
        </div>
        <div class="form-group" style="flex:1; min-width:150px;">
          <label>Tags <button class="cap-copy-inline" onclick="copyCaptionInput('capTags')">📋</button></label>
          <input class="input" id="capTags" placeholder="কমা দিয়ে আলাদা করুন — যেমন: live, viral">
        </div>
      </div>
      <div class="form-group mb-14">
        <label>Minister (ঐচ্ছিক) — এটা দিলে মন্ত্রীর আলাদা ট্যাবে দেখাবে</label>
        <input class="input" id="capMinister" list="capMinisters" placeholder="মন্ত্রীর নাম বাছুন…">
        <datalist id="capMinisters">${captionsState.ministers.map(m => `<option value="${esc(m.name)}">`).join('')}</datalist>
      </div>
      <button class="btn btn-gold" onclick="addCaption()">＋ Add Caption</button>
      </div>
    </div>` : ''}
    <div class="panel">
      <div class="cap-chips mb-14">
        ${captionChipsHtml(chips, filter, expanded)}
      </div>
      ${content}
    </div>
  `;
}

function chipsExpanded() {
  try { const v = localStorage.getItem('mb-cap-chips-expanded'); return v === null ? false : v === '1'; } catch (e) { return false; }
}

function toggleChipsExpand() {
  try { localStorage.setItem('mb-cap-chips-expanded', chipsExpanded() ? '0' : '1'); } catch (e) {}
  const vc = document.getElementById('viewContainer');
  if (vc) renderCaptions(vc);
}

function captionChipsHtml(chips, filter, expanded) {
  const specialKeys = ['All', 'Group', 'Ministry', 'Prime Minister', 'মির্জা ফখরুল ইসলাম আলমগীর'];
  const priority = chips.filter(c => specialKeys.includes(c.key));
  let shown;
  if (expanded) {
    shown = chips.slice();
  } else {
    shown = priority.slice();
    const activeHidden = chips.find(c => c.key === filter && !shown.some(s => s.key === c.key));
    if (activeHidden) shown.push(activeHidden);
    const more = chips.length - shown.length;
    if (more > 0) shown.push({ key: '__more', label: `⋯ আরও ${more} ট্যাব` });
  }
  let btns = shown.map(chip => chip.key === '__more'
    ? `<button class="chip" onclick="toggleChipsExpand()" title="সব ট্যাব দেখান">${esc(chip.label)}</button>`
    : `<button class="chip ${filter === chip.key ? 'active' : ''}" data-f="${esc(chip.key)}" onclick="setCaptionFilter(this.dataset.f)">${esc(chip.label)}</button>`).join('');
  if (expanded) {
    btns += `<button class="chip" onclick="toggleChipsExpand()" title="ট্যাবগুলো লুকান">▲ কম দেখান</button>`;
  }
  return btns;
}

function capCardHtml(c) {
  return `
    <div class="cap-card">
      <div class="cap-texts">
        <div class="cap-line"><span class="cap-tag">Caption</span><span class="cap-text">${esc(c.caption)}</span></div>
        ${c.description ? `<div class="cap-line"><span class="cap-tag cap-tag-desc">Description</span><span class="cap-text">${esc(c.description)}</span></div>` : ''}
        ${c.hashtag ? `<div class="cap-keywords">${c.hashtag.split(/\s+/).map(k => k.trim()).filter(Boolean).map(k => `<span class="cap-kw cap-kw-hash">${esc(k)}</span>`).join('')}</div>` : ''}
        ${c.keywords ? `<div class="cap-keywords">${c.keywords.split(/[,|]/).map(k => k.trim()).filter(Boolean).map(k => `<span class="cap-kw">${esc(k)}</span>`).join('')}</div>` : ''}
        ${c.tags ? `<div class="cap-keywords">${c.tags.split(/[,|]/).map(k => k.trim()).filter(Boolean).map(k => `<span class="cap-kw cap-kw-tag">${esc(k)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="cap-actions">
        <span class="cap-poster">by ${esc(c.poster || 'Team')}</span>
        <button class="btn btn-gold btn-sm" onclick="copyCaption(${c.id}, 'caption', this)">📋 Copy</button>
        ${c.description ? `<button class="btn btn-ghost btn-sm" onclick="copyCaption(${c.id}, 'description', this)">📄 Copy Desc</button>` : ''}
        ${c.hashtag ? `<button class="btn btn-ghost btn-sm" onclick="copyCaption(${c.id}, 'hashtag', this)">#️⃣ Hash</button>` : ''}
        ${c.keywords ? `<button class="btn btn-ghost btn-sm" onclick="copyCaption(${c.id}, 'keywords', this)">🔑 Keys</button>` : ''}
        ${c.tags ? `<button class="btn btn-ghost btn-sm" onclick="copyCaption(${c.id}, 'tags', this)">#️⃣ Tags</button>` : ''}
        ${canManage() ? `<button class="btn btn-ghost btn-sm" title="Edit caption" onclick="openCaptionEdit(${c.id})">✏️ Edit</button>` : ''}
        ${canManage() || (state.user && c.created_by === state.user.id) ? `<button class="btn btn-danger btn-sm" title="Delete caption" onclick="deleteCaption(${c.id})">🗑</button>` : ''}
      </div>
    </div>`;
}

function capListHtml(list) {
  return `<div class="cap-list">${list.map(capCardHtml).join('')}</div>`;
}

function capGroupHtml(cat, list) {
  return `<h4 class="cap-cat">📁 ${esc(cat)} <span class="small">(${list.length})</span></h4>` + capListHtml(list);
}

function ministryGridHtml() {
  return `<div class="ministry-grid">${captionsState.ministers.map(m => `
    <div class="ministry-card">
      <div class="ministry-top">
        ${m.fb_link
          ? `<a class="ministry-name" href="${esc(m.fb_link)}" target="_blank" rel="noopener">🔗 ${esc(m.name)}</a>`
          : `<span class="ministry-name">${esc(m.name)}</span>`}
        ${canManage() ? `<button class="btn btn-ghost btn-sm" title="FB পেজ / ওয়েবসাইট লিংক বসান" onclick="editMinisterLink(${m.id})">✏️ লিংক</button>` : ''}
      </div>
      ${m.designation ? `<div class="ministry-sub">${esc(m.designation)}</div>` : ''}
      ${m.ministry ? `<div class="ministry-sub">${esc(m.ministry)}</div>` : ''}
    </div>`).join('')}</div>`;
}

async function editMinisterLink(id) {
  const m = captionsState.ministers.find(x => x.id === id);
  if (!m) return;
  const url = prompt(`${m.name} — FB পেজ / ওয়েবসাইটের লিংক দিন (খালি রাখলে মুছে যাবে):`, m.fb_link || '');
  if (url === null) return;
  const link = url.trim();
  try {
    await api('/api/ministers/' + id, { method: 'PUT', body: JSON.stringify({ fb_link: link }) });
    toast(link ? 'লিংক সংরক্ষিত ✓' : 'লিংক মুছে ফেলা হয়েছে', 'success');
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

function setCaptionFilter(cat) {
  captionsState.filter = cat;
  saveCaptionPrefs();
  const vc = document.getElementById('viewContainer');
  if (vc) renderCaptions(vc);
}

function setPartyFilter(name) {
  captionsState.partyFilter = name;
  saveCaptionPrefs();
  const vc = document.getElementById('viewContainer');
  if (vc) renderCaptions(vc);
}

function saveCaptionPrefs() {
  try { localStorage.setItem('mb_captions_prefs', JSON.stringify({ filter: captionsState.filter, partyFilter: captionsState.partyFilter })); } catch (e) {}
}

function findPartyPageById(id) {
  for (const p of captionsState.parties) {
    const pg = p.pages.find(x => x.id === id);
    if (pg) return pg;
  }
  return null;
}

function partyGroupHtml() {
  const parties = captionsState.parties;
  const sel = captionsState.partyFilter;
  const party = parties.find(p => p.name === sel) || null;
  const manage = canManage();
  const subChips = parties.map(p => `<button class="chip ${sel === p.name ? 'active' : ''}" data-p="${esc(p.name)}" onclick="setPartyFilter(this.dataset.p)">${esc(p.name)}${p.pages.length ? ` <span class="chip-count">${p.pages.length}</span>` : ''}</button>`).join('');
  const controls = manage ? `
    <div class="flex mb-14" style="flex-wrap:wrap; gap:8px;">
      <button class="btn btn-ghost btn-sm" onclick="addParty()">＋ Party</button>
      ${party ? `
        <button class="btn btn-ghost btn-sm" onclick="renameParty(${party.id})">✏️ Party নাম</button>
        <button class="btn btn-gold btn-sm" onclick="addPartyPage(${party.id})">＋ Page</button>
        <button class="btn btn-danger btn-sm" onclick="deleteParty(${party.id})">🗑 Party</button>` : ''}
    </div>` : '';
  if (!parties.length) {
    return `${controls}<div class="empty">এখনো কোনো রাজনৈতিক দল যোগ হয়নি।${manage ? ' "＋ Party" চেপে যোগ করুন।' : ''}</div>`;
  }
  const list = party && party.pages.length ? party.pages.map(pg => `
    <div class="party-page">
      <div class="party-page-main">
        <a class="party-page-name" href="${esc(pg.url)}" target="_blank" rel="noopener">🔗 ${esc(pg.name)}</a>
        <span class="party-page-url">${esc(pg.url)}</span>
      </div>
      ${manage ? `<div class="party-page-actions">
        <button class="btn btn-ghost btn-sm" title="Edit page" onclick="editPartyPage(${pg.id})">✏️</button>
        <button class="btn btn-danger btn-sm" title="Delete page" onclick="deletePartyPage(${pg.id})">🗑</button>
      </div>` : ''}
    </div>`).join('') : '';
  return `${controls}
    <div class="cap-chips mb-14">${subChips}</div>
    ${!party ? `<div class="empty">দল বাছুন — ফেসবুক পেজের তালিকা দেখতে।</div>`
      : list ? `<h4 class="cap-cat">🎯 ${esc(party.name)} <span class="small">(${party.pages.length} পেজ)</span></h4><div class="party-page-list">${list}</div>`
      : `<div class="empty">এই দলের জন্য এখনো কোনো পেজ যোগ হয়নি।${manage ? ' "＋ Page" চেপে যোগ করুন।' : ''}</div>`}`;
}

async function addParty() {
  const name = prompt('নতুন দলের নাম দিন (ইংরেজিতে):');
  if (!name) return;
  try {
    const r = await api('/api/parties', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
    captionsState.partyFilter = r.party.name;
    toast('Party added ✓', 'success');
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

async function renameParty(id) {
  const p = captionsState.parties.find(x => x.id === id);
  if (!p) return;
  const name = prompt('দলের নতুন নাম:', p.name);
  if (name === null || !name.trim()) return;
  try {
    await api('/api/parties/' + id, { method: 'PUT', body: JSON.stringify({ name: name.trim() }) });
    if (captionsState.partyFilter === p.name) captionsState.partyFilter = name.trim();
    toast('Party updated ✓', 'success');
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteParty(id) {
  const p = captionsState.parties.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`"${p.name}" দলটি এবং এর ${p.pages.length} টি পেজ মুছে ফেলবেন?`)) return;
  try {
    await api('/api/parties/' + id, { method: 'DELETE' });
    if (captionsState.partyFilter === p.name) captionsState.partyFilter = null;
    toast('Party deleted.', 'success');
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

async function addPartyPage(partyId) {
  const p = captionsState.parties.find(x => x.id === partyId);
  if (!p) return;
  const name = prompt(`${p.name} — পেজের নাম (যেমন: BNP Media Cell):`);
  if (name === null) return;
  const url = prompt(`${p.name} — ফেসবুক পেজের লিংক:`);
  if (url === null) return;
  const n = name.trim(), u = url.trim();
  if (!n || !u) return toast('নাম ও লিংক দুইটিই দিন।', 'error');
  try {
    await api('/api/parties/' + partyId + '/pages', { method: 'POST', body: JSON.stringify({ name: n, url: u }) });
    captionsState.partyFilter = p.name;
    toast('Page added ✓', 'success');
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

async function editPartyPage(id) {
  const pg = findPartyPageById(id);
  if (!pg) return;
  const name = prompt('পেজের নাম:', pg.name);
  if (name === null) return;
  const url = prompt('ফেসবুক পেজের লিংক:', pg.url);
  if (url === null) return;
  const n = name.trim(), u = url.trim();
  if (!n || !u) return toast('নাম ও লিংক দুইটিই দিন।', 'error');
  try {
    await api('/api/party-pages/' + id, { method: 'PUT', body: JSON.stringify({ name: n, url: u }) });
    toast('Page updated ✓', 'success');
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

async function deletePartyPage(id) {
  const pg = findPartyPageById(id);
  if (!pg) return;
  if (!confirm(`"${pg.name}" পেজটি মুছে ফেলবেন?`)) return;
  try {
    await api('/api/party-pages/' + id, { method: 'DELETE' });
    toast('Page deleted.', 'success');
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

function capAddHidden() {
  try { const v = localStorage.getItem('mb-cap-add-hidden'); return v === null ? true : v === '1'; } catch (e) { return true; }
}

function toggleCapAdd() {
  const hidden = !capAddHidden();
  try { localStorage.setItem('mb-cap-add-hidden', hidden ? '1' : '0'); } catch (e) {}
  const box = document.getElementById('capAddBox');
  const btn = document.getElementById('capToggle');
  if (box) box.style.display = hidden ? 'none' : 'block';
  if (btn) btn.textContent = hidden ? 'Show Input Box' : 'Hide Input Box';
}

async function addCaption() {
  const category = document.getElementById('capCategory').value.trim();
  const caption = document.getElementById('capText').value.trim();
  const description = document.getElementById('capDesc').value.trim();
  const hashtag = document.getElementById('capHashtag').value.trim();
  const keywords = document.getElementById('capKeywords').value.trim();
  const tags = document.getElementById('capTags').value.trim();
  const minister_name = document.getElementById('capMinister').value.trim();
  if (!caption && !description) return toast('Caption বা Description লিখুন।', 'error');
  try {
    await api('/api/captions', { method: 'POST', body: JSON.stringify({ category: category || 'General', caption, description, hashtag, keywords, tags, minister_name }) });
    toast('Caption added ✓', 'success');
    playSound('success');
    try { localStorage.setItem('mb-cap-add-hidden', '1'); } catch (e) {}
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

function copyCaption(id, field, btn) {
  const c = captionsState.all.find(x => x.id === id);
  if (!c) return;
  const text = field === 'description' ? (c.description || '') : field === 'keywords' ? (c.keywords || '') : field === 'tags' ? (c.tags || '') : field === 'hashtag' ? (c.hashtag || '') : c.caption;
  if (!text) return;
  copyText(text, field === 'description' ? 'Description' : field === 'keywords' ? 'Keywords' : field === 'tags' ? 'Tags' : field === 'hashtag' ? 'Hashtags' : 'Caption', btn);
}

function openCaptionEdit(id) {
  const c = captionsState.all.find(x => x.id === id);
  if (!c) return;
  const cats = [...new Set(captionsState.all.map(x => x.category))].sort((a, b) => a.localeCompare(b));
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>✏️ Edit Caption<button class="close-x" onclick="closeModal()">✕</button></h3>
        <div class="form-group"><label>Category</label>
          <input class="input" id="capEditCategory" list="capEditCats" value="${esc(c.category)}">
          <datalist id="capEditCats">${cats.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        </div>
        <div class="form-group"><label>Caption Text</label>
          <textarea class="input cap-auto" id="capEditCaption" rows="2" oninput="autoGrow(this)">${esc(c.caption)}</textarea>
        </div>
        <div class="form-group"><label>Description</label>
          <textarea class="input cap-auto" id="capEditDesc" rows="2" oninput="autoGrow(this)">${esc(c.description || '')}</textarea>
        </div>
        <div class="form-group"><label>Minister (ঐচ্ছিক)</label>
          <input class="input" id="capEditMinister" list="capMinisters" value="${esc(c.minister_name || '')}">
        </div>
        <div class="flex">
          <div class="form-group" style="flex:1;"><label>Hashtag</label>
            <input class="input" id="capEditHashtag" value="${esc(c.hashtag || '')}" placeholder="স্পেস দিয়ে আলাদা করুন">
          </div>
          <div class="form-group" style="flex:1;"><label>Keywords</label>
            <input class="input" id="capEditKeywords" value="${esc(c.keywords || '')}" placeholder="| দিয়ে আলাদা করুন">
          </div>
          <div class="form-group" style="flex:1;"><label>Tags</label>
            <input class="input" id="capEditTags" value="${esc(c.tags || '')}" placeholder="কমা দিয়ে আলাদা করুন">
          </div>
        </div>
        <div class="flex">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <span class="spacer"></span>
          <button class="btn btn-gold" onclick="saveCaptionEdit(${c.id})">💾 Save</button>
        </div>
      </div>
    </div>`;
  autoGrow(document.getElementById('capEditCaption'));
  autoGrow(document.getElementById('capEditDesc'));
}

async function saveCaptionEdit(id) {
  const category = document.getElementById('capEditCategory').value.trim();
  const caption = document.getElementById('capEditCaption').value.trim();
  const description = document.getElementById('capEditDesc').value.trim();
  const hashtag = document.getElementById('capEditHashtag').value.trim();
  const keywords = document.getElementById('capEditKeywords').value.trim();
  const tags = document.getElementById('capEditTags').value.trim();
  const minister_name = document.getElementById('capEditMinister').value.trim();
  if (!caption) return toast('Caption লিখুন।', 'error');
  try {
    await api('/api/captions/' + id, { method: 'PUT', body: JSON.stringify({ category: category || 'General', caption, description, hashtag, keywords, tags, minister_name }) });
    toast('Caption updated ✓', 'success');
    playSound('success');
    closeModal();
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

function copyCaptionInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.value.trim();
  if (!text) return toast('আগে কিছু লিখুন।', 'error');
  copyText(text, 'Text', null);
}

async function deleteCaption(id) {
  if (!confirm('এই ক্যাপশনটি মুছে ফেলবেন?')) return;
  try {
    await api('/api/captions/' + id, { method: 'DELETE' });
    toast('Caption deleted.', 'success');
    renderCaptions(document.getElementById('viewContainer'));
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= MISC ================= */

function downloadPdf(url) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  a.click();
}

function copyFrom(btn) {
  const label = (btn.title || '').replace(/ copy link$/i, '');
  copyText(btn.dataset.copy || '', label || 'Link', btn);
}

function copyText(text, label, btn) {
  const done = () => {
    toast(`${label || 'Link'} copied ✓`, 'success');
    flashCopied(btn);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}

function flashCopied(btn) {
  if (!btn) return;
  const old = btn.innerHTML;
  btn.innerHTML = 'COPIED ✓';
  btn.classList.add('copied');
  clearTimeout(btn._copiedT);
  btn._copiedT = setTimeout(() => { btn.innerHTML = old; btn.classList.remove('copied'); }, 1200);
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(ta);
  ta.focus();
  ta.setSelectionRange(0, ta.value.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  if (ok) done();
}

async function boot() {
  window.addEventListener('error', e => {
    if (e && e.message) console.error('[global]', e.message, e.filename + ':' + (e.lineno || ''));
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e && e.reason;
    console.error('[global] unhandled rejection', r && r.message ? r.message : r);
  });
  state.soundOn = localStorage.getItem('mb-sound') !== 'off';
  document.getElementById('soundBtn').textContent = state.soundOn ? '🔊' : '🔇';
  document.getElementById('soundBtn').classList.toggle('muted', state.soundOn === false);

  try { await loadDesignations(); } catch (e) {}
  updateClock();
  setInterval(updateClock, 1000);
  fetchWeather();
  setInterval(fetchWeather, 10 * 60 * 1000);
  try {
    const me = await api('/api/me');
    state.user = me.user;
    initApp();
  } catch (e) {
    showAuth();
    const savedTab = localStorage.getItem('mb-auth-tab');
    if (savedTab === 'login' || savedTab === 'register') showTab(savedTab);
  }
}

document.addEventListener('DOMContentLoaded', boot);
