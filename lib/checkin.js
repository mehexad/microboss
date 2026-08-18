const { db, stmts, nowIso, todayStr } = require('./db');

function openFor(userId) {
  return stmts.findOpenCheckIn.get(userId);
}

function isSameLocalDay(isoStr, dateStr) {
  if (!isoStr || !dateStr) return false;
  const d = new Date(isoStr);
  if (isNaN(d)) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === dateStr;
}

function checkIn(userId) {
  const open = openFor(userId);
  if (open) {
    if (isSameLocalDay(open.check_in_at, todayStr())) {
      return { record: open, created: false };
    }
    stmts.checkoutCheckIn.run(nowIso(), open.id);
  }
  stmts.createCheckIn.run(userId, nowIso(), nowIso());
  return { record: openFor(userId), created: true };
}

function checkOut(userId) {
  const open = openFor(userId);
  if (!open) return null;
  if (open.check_out_at) return open;
  stmts.checkoutCheckIn.run(nowIso(), open.id);
  return stmts.findCheckInById.get(open.id);
}

function durationMs(row) {
  if (!row || !row.check_in_at) return 0;
  const start = new Date(row.check_in_at);
  const end = row.check_out_at ? new Date(row.check_out_at) : new Date();
  const ms = end - start;
  return ms > 0 ? ms : 0;
}

function formatRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    check_in_at: row.check_in_at,
    check_out_at: row.check_out_at,
    duration_ms: durationMs(row)
  };
}

function status(userId) {
  const open = openFor(userId);
  return {
    active: !!open && !open.check_out_at,
    check_in_at: open ? open.check_in_at : null,
    check_out_at: open ? open.check_out_at : null,
    today: stmts.listCheckInsToday.all().map(formatRow),
    total_today: stmts.listCheckInsToday.all().length,
    members_active_now: stmts.countMembersCheckedInToday.get().c
  };
}

module.exports = { checkIn, checkOut, openFor, status, durationMs };
