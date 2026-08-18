const { db, stmts, todayStr, monthRange, monthName } = require('./db');

function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db_ = new Date(b + 'T00:00:00');
  return Math.round((db_ - da) / 86400000);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sponsorStats(sponsor) {
  const today = todayStr();
  const doneToday = stmts.countForSponsorOnDate.get(sponsor.id, today).c;
  const doneTotal = stmts.countForSponsorTotal.get(sponsor.id).c;

  const dailyTarget = sponsor.daily_target > 0 ? sponsor.daily_target : 0;
  const dailyRemaining = dailyTarget > 0 ? Math.max(0, dailyTarget - doneToday) : null;

  const deadline = sponsor.deadline || null;
  const start = sponsor.start_date || null;
  let daysLeft = null;
  let deadlineDone = doneTotal;
  let deadlineRemaining = null;

  if (deadline) {
    daysLeft = daysBetween(today, deadline);
    if (start) {
      deadlineDone = stmts.countForSponsorInRange.get(sponsor.id, start, today).c;
    }
    deadlineRemaining = Math.max(0, sponsor.total_videos - deadlineDone);
  }

  const remainingDaysUntilDeadline = deadline ? Math.max(0, daysLeft) : null;

  let needPerDay = null;
  if (deadline && remainingDaysUntilDeadline > 0 && sponsor.total_videos > 0 && deadlineRemaining > 0) {
    needPerDay = Math.ceil(deadlineRemaining / remainingDaysUntilDeadline);
  }

  const percentDone = sponsor.total_videos > 0
    ? Math.min(100, Math.round((doneTotal / sponsor.total_videos) * 100))
    : 0;

  return {
    id: sponsor.id,
    name: sponsor.name,
    note: sponsor.note,
    content_type: sponsor.content_type,
    start_date: start,
    deadline,
    total_videos: sponsor.total_videos,
    daily_target: dailyTarget,
    status: sponsor.status,
    completed_at: sponsor.completed_at || '',
    today: { done: doneToday, target: dailyTarget, remaining: dailyRemaining },
    deadline_: {
      days_left: daysLeft,
      done: deadlineDone,
      remaining: deadlineRemaining,
      remaining_days: remainingDaysUntilDeadline,
      need_per_day: needPerDay,
      percent_done: percentDone
    }
  };
}

function allSponsorStats() {
  const sponsors = stmts.listSponsors.all();
  return sponsors.map(sponsorStats);
}

function activeSponsorStats() {
  return allSponsorStats().filter(s => s.status === 'active');
}

function monthlyStats(year, month) {
  const { first, last } = monthRange(year, month);
  const total = stmts.countContentsInMonth.get(first, last).c;
  const videos = stmts.countVideoInMonth.get(first, last).c;
  const statics = stmts.countStaticInMonth.get(first, last).c;
  const sponsored = stmts.countSponsoredInMonth.get(first, last).c;
  const free = stmts.countFreeInMonth.get(first, last).c;

  const perMember = stmts.countByMemberInMonth.all(first, last).map(r => {
    const u = stmts.findUserById.get(r.uploaded_by);
    return {
      user_id: r.uploaded_by,
      username: u ? u.username : 'Unknown',
      count: r.c
    };
  }).sort((a, b) => b.count - a.count);

  return { year, month, first, last, total, videos, statics, sponsored, free, per_member: perMember };
}

function hourLabel(h) {
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${ap}`;
}

function analytics(year, month) {
  const { first, last } = monthRange(year, month);
  const now = new Date();
  const today = todayStr();

  const monthly = stmts.countContentsInMonth.get(first, last).c;
  const videos = stmts.countVideoInMonth.get(first, last).c;
  const statics = stmts.countStaticInMonth.get(first, last).c;
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  const totalDays = isCurrent
    ? now.getDate()
    : new Date(year, month, 0).getDate();
  const daily_average = totalDays > 0 ? Math.round((monthly / totalDays) * 10) / 10 : 0;
  const daily_average_video = totalDays > 0 ? Math.round((videos / totalDays) * 10) / 10 : 0;
  const daily_average_static = totalDays > 0 ? Math.round((statics / totalDays) * 10) / 10 : 0;

  const dayRows = stmts.countByDayInRange.all(first, last);
  let best_day = null;
  if (dayRows.length) {
    const best = dayRows.reduce((a, b) => (b.c > a.c ? b : a));
    best_day = { date: best.upload_date, count: best.c };
  }

  const pdRow = stmts.platformDistributionInMonth.get(first, last);
  const platform_distribution = Object.keys(pdRow)
    .map(k => ({ key: k, count: pdRow[k] || 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekStart = addDays(today, -6);
  const weekRows = stmts.countByDayInRange.all(weekStart, today);
  const byDay = {};
  for (const r of weekRows) byDay[r.upload_date] = r.c;
  const weekly_performance = [];
  let d = weekStart;
  while (d <= today) {
    const dt = new Date(d + 'T00:00:00');
    weekly_performance.push({ date: d, label: WEEKDAY_SHORT[dt.getDay()], count: byDay[d] || 0 });
    d = addDays(d, 1);
  }
  const best_week_day = weekly_performance.reduce((a, b) => (b.count > a.count ? b : a), weekly_performance[0] || { count: 0, label: '' });

  const slotRows = stmts.countBySlotOnDate.all(today);
  const byHour = {};
  for (const r of slotRows) {
    const h = Number(String(r.upload_time).slice(0, 2));
    if (!isNaN(h)) byHour[h] = (byHour[h] || 0) + r.c;
  }
  const hourly_activity = [];
  for (let h = 0; h < 24; h++) {
    hourly_activity.push({ hour: h, label: hourLabel(h), count: byHour[h] || 0 });
  }
  const best_hour = hourly_activity.reduce((a, b) => (b.count > a.count ? b : a), hourly_activity[0]);
  const today_count = stmts.countContentsToday.get(today).c;

  return {
    month_name: monthName(year, month),
    today_count,
    monthly,
    videos,
    statics,
    daily_average,
    daily_average_video,
    daily_average_static,
    best_day,
    platform_distribution,
    weekly_performance,
    best_week_day,
    hourly_activity,
    best_hour
  };
}

const DEADLINE_ALERT_DAYS = 5;

function sponsorDailyCompliance(sponsor) {
  if (!sponsor.daily_target || sponsor.daily_target <= 0) return null;
  const today = todayStr();
  const start = sponsor.start_date || addDays(today, -14);
  if (start > today) return null;
  const rows = stmts.countForSponsorByDayInRange.all(sponsor.id, start, today);
  const byDay = {};
  for (const r of rows) byDay[r.upload_date] = r.c;
  const missedDays = [];
  let d = start;
  while (d <= today) {
    if ((byDay[d] || 0) < sponsor.daily_target) missedDays.push(d);
    d = addDays(d, 1);
  }
  return { missed: missedDays.length > 0, missed_days: missedDays };
}

function computeDeadlineAlerts() {
  const today = todayStr();
  const sponsors = stmts.listSponsors.all().filter(s => s.status === 'active' && s.deadline);
  const users = stmts.listUsers.all();
  const alerts = [];

  for (const s of sponsors) {
    const stats = sponsorStats(s);
    if (stats.deadline_.days_left === null) continue;
    const daily = sponsorDailyCompliance(s);
    let msg;
    let urgent = false;
    let level = daily === null ? 'warn' : (daily.missed ? 'red' : 'green');
    if (stats.deadline_.days_left < 0) {
      msg = `সময়সীমা অতিক্রম: "${s.name}" স্পনসরের ডেডলাইন ${s.deadline} পেরিয়ে গেছে। এখনও ${stats.deadline_.remaining}টি ভিডিও বাকি!`;
      urgent = true;
      level = 'red';
    } else if (stats.deadline_.days_left <= DEADLINE_ALERT_DAYS && stats.deadline_.remaining > 0) {
      msg = `জরুরি: "${s.name}" স্পনসরের ডেডলাইন ${stats.deadline_.days_left} দিন বাকি (${s.deadline})। এখনও ${stats.deadline_.remaining}টি ভিডিও দরকার। সময়মতো শেষ করতে প্রতিদিন ~${stats.deadline_.need_per_day ?? '?'}টি ভিডিও লাগবে!`;
      urgent = stats.deadline_.days_left <= 2;
      if (daily !== null) {
        if (daily.missed) msg += ` দৈনিক টার্গেট ${daily.missed_days.length} দিন মিস হয়েছে।`;
        else msg += ` দৈনিক টার্গেট ঠিকঠাক চলছে।`;
      }
    } else {
      continue;
    }
    alerts.push({ sponsor: s, stats, message: msg, urgent, daily, level });
  }

  for (const u of users) {
    for (const a of alerts) {
      const exists = stmts.existsNotificationToday.get(u.id, a.sponsor.id, 'deadline', today + '%').c;
      if (!exists) {
        stmts.createNotification.run(u.id, a.sponsor.id, a.message, 'deadline', a.level, 0, today);
      }
    }
  }

  return alerts;
}

module.exports = { sponsorStats, allSponsorStats, activeSponsorStats, monthlyStats, analytics, computeDeadlineAlerts, daysBetween, addDays };
