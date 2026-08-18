const PDFDocument = require('pdfkit');
const path = require('path');
const { stmts, nowIso } = require('./db');
const { sponsorStats } = require('./tracking');

const GOLD = '#FFC709';
const NAVY = '#0A1628';
const FONT_DIR = path.join(__dirname, 'fonts');
const BANGLA_REGULAR = path.join(FONT_DIR, 'NotoSerifBengali-Regular.ttf');
const BANGLA_SEMIBOLD = path.join(FONT_DIR, 'NotoSerifBengali-SemiBold.ttf');
const BANGLA_BOLD = path.join(FONT_DIR, 'NotoSerifBengali-Bold.ttf');

function periodLabel(from, to) {
  return (from && to) ? `${from} → ${to}` : '';
}

function contentsForSponsor(sponsorId, from, to) {
  return (from && to) ? stmts.listForSponsorRange.all(sponsorId, from, to) : stmts.listForSponsor.all(sponsorId);
}

function contentsForUser(userId, from, to) {
  return (from && to) ? stmts.listForUserRange.all(userId, from, to) : stmts.listForUser.all(userId);
}

function registerBangla(doc) {
  doc.registerFont('Bangla', BANGLA_REGULAR);
  doc.registerFont('BanglaSemibold', BANGLA_SEMIBOLD);
  doc.registerFont('BanglaBold', BANGLA_BOLD);
}

function banglaNum(n) {
  const map = { '0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯' };
  return String(n).split('').map(ch => map[ch] || ch).join('');
}

function sponsorPdf(sponsorId, includeContent = true, from = null, to = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const s = stmts.findSponsor.get(sponsorId);
    if (!s) return reject(new Error('Sponsor not found'));
    const stats = sponsorStats(s);
    registerBangla(doc);

    doc.rect(0, 0, doc.page.width, 60).fill(NAVY);
    doc.fill(GOLD).fontSize(22).font('BanglaBold')
      .text('MICROBOSS', 40, 15);
    doc.fill('#FFFFFF').fontSize(11).font('Bangla')
      .text('Sponsor Report', 40, 42);
    doc.fillColor('#8B94A7').fontSize(9)
      .text(`Generated: ${nowIso().slice(0, 16).replace('T', ' ')}`, doc.page.width - 200, 20, { width: 160, align: 'right' });

    let y = 80;
    doc.fill(NAVY).fontSize(16).font('BanglaBold').text(`Sponsor: ${s.name}`, 40, y);
    y += 26;

    doc.font('Bangla').fontSize(10);
    const meta = [
      ['Status', s.status.toUpperCase()],
      ['Start Date', s.start_date || 'N/A'],
      ['Deadline', s.deadline || 'N/A'],
      ['Content Type', s.content_type || 'N/A'],
      ['Total Videos (Contract)', String(s.total_videos)],
      ['Daily Target', String(s.daily_target || 'N/A')],
      ['Videos Done (Today)', String(stats.today.done)],
      ['Videos Done (Overall)', String(stats.deadline_.done)],
      ['Videos Remaining', String(stats.deadline_.remaining)],
      ['Days Left to Deadline', stats.deadline_.days_left === null ? 'N/A' : String(stats.deadline_.days_left)],
      ['Remaining Videos/Day', stats.deadline_.need_per_day === null ? 'N/A' : String(stats.deadline_.need_per_day)]
    ];
    const boxX = 40, boxY = y, boxW = doc.page.width - 80;
    doc.roundedRect(boxX, boxY, boxW, 30 + meta.length * 18, 8).fill('#F5F6F8');
    doc.fill(NAVY);
    for (const [k, v] of meta) {
      doc.font('BanglaBold').text(k, boxX + 14, y + 6, { width: 200 });
      doc.font('Bangla').text(v, boxX + 230, y + 6, { width: 320 });
      y += 18;
    }

    if (s.note) {
      y += 6;
      doc.font('BanglaBold').text('Notes', 40, y);
      y += 14;
      doc.font('Bangla').text(s.note, 40, y, { width: doc.page.width - 80 });
      y += 22;
    }

    const period = periodLabel(from, to);
    if (period) {
      doc.font('BanglaBold').text(`Period: ${period}`, 40, y, { width: doc.page.width - 80 });
      y += 22;
    }

    const contents = contentsForSponsor(sponsorId, from, to);

    if (includeContent && contents.length > 0) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 50).fill(NAVY);
      doc.fill(GOLD).fontSize(16).font('BanglaBold').text('Delivered Videos', 40, 15);

      const headerY = 66;
      const cols = [30, 95, 90, 200, 135];
      const titles = ['#', 'Date', 'Uploaded By', 'Headline', 'Links Count'];
      doc.font('BanglaBold').fontSize(9);
      doc.roundedRect(40, headerY - 14, doc.page.width - 80, 22, 5).fill(NAVY);
      doc.fill(GOLD);
      let x = 44;
      cols.forEach((w, i) => { doc.text(titles[i], x, headerY - 9, { width: w - 4 }); x += w; });

      let yy = headerY + 14;
      doc.font('Bangla').fontSize(9).fillColor('#222');
      contents.forEach((c, idx) => {
        if (yy > doc.page.height - 60) { doc.addPage(); yy = 50; }
        const u = stmts.findUserById.get(c.uploaded_by);
        const links = [c.youtube, c.facebook, c.instagram, c.threads, c.x, c.tiktok, c.bluesky, c.reddit, c.pinterest, c.dailymotion]
          .filter(l => l && l.trim());
        x = 44;
        const vals = [
          String(idx + 1),
          c.upload_date,
          u ? u.username : '',
          c.headline || (c.slug || ''),
          links.length > 0 ? `${links.length} link(s)` : 'No links'
        ];
        cols.forEach((w, i) => { doc.text(vals[i], x, yy, { width: w - 4, ellipsis: true }); x += w; });
        yy += 20;
      });
    } else if (includeContent) {
      doc.font('Bangla').fontSize(11).fill('#666').text('No videos delivered for this sponsor yet.', 40, y + 10);
    }

    doc.end();
  });
}

function allSponsorsPdf(from = null, to = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    registerBangla(doc);
    doc.rect(0, 0, doc.page.width, 60).fill(NAVY);
    doc.fill(GOLD).fontSize(22).font('BanglaBold').text('MICROBOSS', 40, 15);
    doc.fill('#FFFFFF').fontSize(11).font('Bangla').text('All Sponsors Summary Report', 40, 42);
    doc.fillColor('#8B94A7').fontSize(9).text(`Generated: ${nowIso().slice(0, 16).replace('T', ' ')}`, doc.page.width - 200, 20, { width: 160, align: 'right' });

    const period = periodLabel(from, to);
    if (period) {
      doc.fillColor('#C9A400').fontSize(9).font('Bangla').text(`Period: ${period}`, 40, 66, { width: doc.page.width - 80 });
    }

    const sponsors = stmts.listSponsors.all();
    let y = period ? 92 : 85;
    if (sponsors.length === 0) {
      doc.fill('#666').font('Bangla').text('No sponsors yet.', 40, y);
    }
    for (const s of sponsors) {
      const st = sponsorStats(s);
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
      doc.roundedRect(40, y - 4, doc.page.width - 80, 78, 6).fill('#F5F6F8');
      doc.fill(NAVY).font('Bangla').fontSize(13).text(s.name, 52, y);
      doc.font('Bangla').fontSize(9).fill('#444').text(
        `${s.status}  |  ${s.start_date || '?'}  ->  ${s.deadline || '?'}  |  Contract: ${s.total_videos} videos  |  Done: ${st.deadline_.done}  |  Remaining: ${st.deadline_.remaining}  |  Days left: ${st.deadline_.days_left === null ? 'N/A' : st.deadline_.days_left}${period ? `  |  Done (${period}): ${stmts.countForSponsorInRange.get(s.id, from, to).c}` : ''}`,
        52, y + 18, { width: doc.page.width - 120 });
      doc.fill(GOLD).fontSize(9).font('BanglaBold').text(`Progress: ${st.deadline_.percent_done}%`, 52, y + 34);
      doc.rect(52, y + 46, doc.page.width - 120, 8).fill('#E2E5EA');
      doc.rect(52, y + 46, Math.max(0, (doc.page.width - 120) * st.deadline_.percent_done / 100), 8).fill(GOLD);
      y += 92;
    }

    doc.end();
  });
}

function contentLinks(c) {
  return [c.youtube, c.facebook, c.instagram, c.threads, c.x, c.tiktok, c.bluesky, c.reddit, c.pinterest, c.dailymotion]
    .filter(l => l && String(l).trim());
}

function contentLinksLabeled(c) {
  const pairs = [
    ['YouTube', c.youtube], ['Facebook', c.facebook], ['Instagram', c.instagram],
    ['Threads', c.threads], ['X', c.x], ['TikTok', c.tiktok], ['Bluesky', c.bluesky],
    ['Reddit', c.reddit], ['Pinterest', c.pinterest], ['Dailymotion', c.dailymotion]
  ];
  return pairs.filter(([, v]) => v && String(v).trim()).map(([platform, url]) => ({ platform, url: String(url).trim() }));
}

const PLATFORMS = ['YouTube', 'Facebook', 'Instagram', 'Threads', 'X', 'TikTok', 'Bluesky', 'Reddit', 'Pinterest', 'Dailymotion'];

function stripUrl(u) {
  return String(u).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}

function linksTablePdf(doc, subtitle, rows, showUploader = false, linkViewPairs = false, showSponsor = false) {
  const tablePage = () => doc.addPage({ size: 'A4', layout: 'landscape' });
  tablePage();
  doc.rect(0, 0, doc.page.width, 50).fill(NAVY);
  doc.fill(GOLD).fontSize(16).font('BanglaBold').text('Content Report', 40, 15);
  doc.fill('#FFFFFF').fontSize(10).font('Bangla').text(subtitle, 40, 35);

  const used = PLATFORMS.filter(p => rows.some(r => (r.links || []).some(l => l.platform === p)));

  const left = 40;
  const tableW = doc.page.width - 80;
  const SL = 30, DATE = 62, UP = 80, SPON = 70, HEAD = 220, VIEW = 110;
  const colDefs = [['SL', SL], ['DATE', DATE]];
  if (showUploader) colDefs.push(['UPLOADED BY', UP]);
  if (showSponsor) colDefs.push(['SPONSOR', SPON]);
  colDefs.push(['CONTENT HEADLINE', HEAD]);
  const fixedW = tableW - SL - DATE - (showUploader ? UP : 0) - (showSponsor ? SPON : 0) - HEAD;
  if (linkViewPairs) {
    const pairW = used.length ? Math.floor(fixedW / used.length) : 0;
    const linkW = Math.round(pairW * 0.62);
    const viewW = pairW - linkW;
    used.forEach(p => { colDefs.push([`${p.toUpperCase()} LINK`, linkW]); colDefs.push([`${p.toUpperCase()} VIEW`, viewW]); });
  } else {
    const platformW = used.length ? Math.floor((fixedW - VIEW) / used.length) : 0;
    used.forEach(p => colDefs.push([p.toUpperCase(), platformW]));
    colDefs.push(['VIEW', VIEW]);
  }
  const colX = [];
  let acc = left;
  colDefs.forEach(([, w]) => { colX.push(acc); acc += w; });

  const headerH = linkViewPairs ? 26 : 22, BASE_ROW = 22;

  function drawHeader(yy) {
    doc.rect(left, yy, tableW, headerH).fill(NAVY);
    doc.font('BanglaBold').fontSize(linkViewPairs ? 7 : 8).fill(GOLD);
    colDefs.forEach(([t], i) => doc.text(t, colX[i] + 3, yy + 5, { width: colDefs[i][1] - 6 }));
  }

  drawHeader(64);
  let yy = 64 + headerH;

  if (rows.length === 0) {
    doc.font('Bangla').fontSize(11).fillColor('#666').text('No content found.', 40, yy + 10);
    return;
  }

  function textH(fontName, size, text, width) {
    doc.font(fontName).fontSize(size);
    return Math.ceil(doc.heightOfString(text || '', { width }));
  }

  rows.forEach((r, idx) => {
    const urlFor = {};
    (r.links || []).forEach(l => { urlFor[l.platform] = l.url; });

    const headText = r.headline || '—';
    const upText = showUploader ? (r.uploader || '—') : '';
    const spText = showSponsor ? (r.sponsor || '') : '';
    const headH = textH('Bangla', 8.5, headText, HEAD - 8);
    const upH = showUploader ? textH('Bangla', 8, upText, UP - 8) : 0;
    const spH = showSponsor ? textH('Bangla', 8, spText, SPON - 8) : 0;
    const rh = Math.max(BASE_ROW, headH + 5, upH + 5, spH + 5);

    if (yy + rh > doc.page.height - 40) {
      tablePage();
      drawHeader(40);
      yy = 40 + headerH;
    }

    function cell(x, w) {
      doc.rect(x, yy, w, rh).strokeColor('#D8DCE3').lineWidth(0.4).stroke();
    }

    cell(colX[0], SL);
    doc.font('BanglaBold').fontSize(9).fillColor('#222').text(String(idx + 1), colX[0], yy + rh / 2 - 4, { width: SL, align: 'center' });

    cell(colX[1], DATE);
    doc.font('Bangla').fontSize(8).fillColor('#555').text(r.date || '', colX[1], yy + rh / 2 - 4, { width: DATE, align: 'center' });

    let ci = 2;
    if (showUploader) {
      cell(colX[ci], UP);
      doc.font('Bangla').fontSize(8).fillColor('#333').text(upText, colX[ci] + 4, yy + (rh - upH) / 2, { width: UP - 8 });
      ci++;
    }

    if (showSponsor) {
      cell(colX[ci], SPON);
      doc.font('Bangla').fontSize(8).fillColor('#333').text(spText, colX[ci] + 4, yy + (rh - spH) / 2, { width: SPON - 8 });
      ci++;
    }

    cell(colX[ci], HEAD);
    doc.font('Bangla').fontSize(8.5).fillColor('#222').text(headText, colX[ci] + 4, yy + (rh - headH) / 2, { width: HEAD - 8 });
    ci++;

    if (linkViewPairs) {
      for (const p of used) {
        const u = urlFor[p];
        const lw = colDefs[ci][1];
        cell(colX[ci], lw);
        doc.font('Bangla').fontSize(6.5).fillColor(u ? '#1155cc' : '#CCC')
          .text(u ? stripUrl(u) : '', colX[ci] + 3, yy + rh / 2 - 3, { width: lw - 6, ellipsis: true });
        ci++;
        cell(colX[ci], colDefs[ci][1]);
        ci++;
      }
    } else {
      for (const p of used) {
        const u = urlFor[p];
        const w = colDefs[ci][1];
        cell(colX[ci], w);
        doc.font('Bangla').fontSize(6.5).fillColor(u ? '#1155cc' : '#CCC')
          .text(u ? stripUrl(u) : '', colX[ci] + 3, yy + rh / 2 - 3, { width: w - 6, ellipsis: true });
        ci++;
      }
      cell(colX[ci], colDefs[ci][1]);
    }
    yy += rh;
  });

  if (yy + 26 > doc.page.height - 40) { tablePage(); yy = 50; }
  yy += 6;
  doc.rect(left, yy, tableW, BASE_ROW).fill('#F5F6F8');
  doc.rect(left, yy, tableW, BASE_ROW).strokeColor('#D8DCE3').lineWidth(0.4).stroke();
  doc.font('BanglaBold').fontSize(9).fill(NAVY)
    .text(`TOTAL CONTENTS: ${rows.length}`, left + 8, yy + 5);
}

function sponsorReportPdf(sponsorId, from = null, to = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const s = stmts.findSponsor.get(sponsorId);
    if (!s) return reject(new Error('Sponsor not found'));
    const contents = contentsForSponsor(sponsorId, from, to);
    registerBangla(doc);

    doc.rect(0, 0, doc.page.width, 60).fill(NAVY);
    doc.fill(GOLD).fontSize(22).font('BanglaBold').text('MICROBOSS', 40, 15);
    doc.fill('#FFFFFF').fontSize(11).font('Bangla').text('Sponsor Report', 40, 42);
    doc.fillColor('#8B94A7').fontSize(9)
      .text(`Generated: ${nowIso().slice(0, 16).replace('T', ' ')}`, doc.page.width - 200, 20, { width: 160, align: 'right' });

    let y = 80;
    doc.fill(NAVY).fontSize(16).font('Bangla').text(`Sponsor: ${s.name}`, 40, y);
    y += 26;
    doc.font('Bangla').fontSize(10).fill('#444')
      .text(`Status: ${s.status.toUpperCase()}  |  Period: ${s.start_date || '?'} → ${s.deadline || '?'}  |  Contract: ${s.total_videos} videos`, 40, y, { width: doc.page.width - 80 });
    const period = periodLabel(from, to);
    if (period) {
      y += 18;
      doc.font('BanglaBold').text(`Report Period: ${period}`, 40, y, { width: doc.page.width - 80 });
    }

    linksTablePdf(doc, `${s.name} — ${contents.length} content(s)${period ? ' [' + period + ']' : ''}`, contents.map(c => ({ headline: c.headline || c.slug || '', date: c.upload_date || '', links: contentLinksLabeled(c) })), false, true);
    doc.end();
  });
}

function employeeReportPdf(userId, from = null, to = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const u = stmts.findUserById.get(userId);
    if (!u) return reject(new Error('Employee not found'));
    const contents = contentsForUser(userId, from, to);
    registerBangla(doc);

    doc.rect(0, 0, doc.page.width, 60).fill(NAVY);
    doc.fill(GOLD).fontSize(22).font('BanglaBold').text('MICROBOSS', 40, 15);
    doc.fill('#FFFFFF').fontSize(11).font('Bangla').text('Employee Report', 40, 42);
    doc.fillColor('#8B94A7').fontSize(9)
      .text(`Generated: ${nowIso().slice(0, 16).replace('T', ' ')}`, doc.page.width - 200, 20, { width: 160, align: 'right' });

    let y = 80;
    doc.fill(NAVY).fontSize(16).font('Bangla').text(`Employee: ${u.username}`, 40, y);
    y += 26;
    doc.font('Bangla').fontSize(10).fill('#444')
      .text(`Office ID: ${u.office_id}  |  Designation: ${u.designation || 'N/A'}  |  Office: ${u.office_name || 'N/A'}`, 40, y, { width: doc.page.width - 80 });
    const period = periodLabel(from, to);
    if (period) {
      y += 18;
      doc.font('BanglaBold').text(`Report Period: ${period}`, 40, y, { width: doc.page.width - 80 });
    }

    linksTablePdf(doc, `${u.username} — ${contents.length} content(s)${period ? ' [' + period + ']' : ''}`, contents.map(c => ({ headline: c.headline || c.slug || '', date: c.upload_date || '', uploader: (stmts.findUserById.get(c.uploaded_by) || {}).username || '', links: contentLinksLabeled(c) })), true);
    doc.end();
  });
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function linksCsv(contents) {
  const header = 'SL,Date,Headline,Links';
  const lines = contents.map((c, i) => [i + 1, c.upload_date || '', c.headline || c.slug || '', contentLinks(c).join('; ')].map(csvEscape).join(','));
  return '\uFEFF' + header + '\n' + lines.join('\n') + '\n';
}

function slotCsv(rows) {
  const header = 'SL,Date,Sponsor,Uploaded By,Headline,Links';
  const lines = rows.map((c, i) => [i + 1, c.date || '', c.sponsor || '', c.uploader || '', c.headline || '', c.linksText || ''].map(csvEscape).join(','));
  return '\uFEFF' + header + '\n' + lines.join('\n') + '\n';
}

function sponsorReportCsv(sponsorId, from = null, to = null) {
  const s = stmts.findSponsor.get(sponsorId);
  if (!s) throw new Error('Sponsor not found');
  return linksCsv(contentsForSponsor(sponsorId, from, to));
}

function employeeReportCsv(userId, from = null, to = null) {
  const u = stmts.findUserById.get(userId);
  if (!u) throw new Error('Employee not found');
  return linksCsv(contentsForUser(userId, from, to));
}

/* ============ SLOT REPORT ============ */

function slotContents(slotKey, from = null, to = null) {
  if (!slotKey) return [];
  const label = slotKey.startsWith('L:') ? slotKey.slice(2) : '';
  const time = slotKey.startsWith('T:') ? slotKey.slice(2) : '';
  if (label) return (from && to) ? stmts.listForSlotLabelRange.all(label, from, to) : stmts.listForSlotLabel.all(label);
  if (time) return (from && to) ? stmts.listForSlotTimeRange.all(time, from, to) : stmts.listForSlotTime.all(time);
  return [];
}

function slotLabelText(slotKey) {
  if (!slotKey) return 'Unknown';
  return slotKey.startsWith('L:') ? slotKey.slice(2) : (slotKey.startsWith('T:') ? slotKey.slice(2) : slotKey);
}

function slotReportPdf(slotKey, from = null, to = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contents = slotContents(slotKey, from, to);
    registerBangla(doc);

    doc.rect(0, 0, doc.page.width, 60).fill(NAVY);
    doc.fill(GOLD).fontSize(22).font('BanglaBold').text('MICROBOSS', 40, 15);
    doc.fill('#FFFFFF').fontSize(11).font('Bangla').text('Slot Report', 40, 42);
    doc.fillColor('#8B94A7').fontSize(9)
      .text(`Generated: ${nowIso().slice(0, 16).replace('T', ' ')}`, doc.page.width - 200, 20, { width: 160, align: 'right' });

    let y = 80;
    doc.fill(NAVY).fontSize(16).font('Bangla').text(`Slot: ${slotLabelText(slotKey)}`, 40, y);
    const period = periodLabel(from, to);
    if (period) {
      y += 26;
      doc.font('BanglaBold').fontSize(10).fill('#444').text(`Report Period: ${period}`, 40, y, { width: doc.page.width - 80 });
    }

    const rows = contents.map(c => ({
      headline: c.headline || c.slug || '',
      date: c.upload_date || '',
      uploader: c.uploaded_by_name || '',
      sponsor: c.sponsor_name || '',
      links: contentLinksLabeled(c)
    }));
    linksTablePdf(doc, `${slotLabelText(slotKey)} — ${rows.length} content(s)${period ? ' [' + period + ']' : ''}`, rows, true, false, true);
    doc.end();
  });
}

function slotReportCsv(slotKey, from = null, to = null) {
  const contents = slotContents(slotKey, from, to);
  const rows = contents.map(c => ({
    date: c.upload_date || '',
    sponsor: c.sponsor_name || '',
    uploader: c.uploaded_by_name || '',
    headline: c.headline || c.slug || '',
    linksText: contentLinks(c).join('; ')
  }));
  return slotCsv(rows);
}

/* ============ OFFICE TIMING REPORT ============ */

function isLocalMonth(isoStr, year, month) {
  if (!isoStr || !year || !month) return false;
  const d = new Date(isoStr);
  if (isNaN(d)) return false;
  return d.getFullYear() === Number(year) && (d.getMonth() + 1) === Number(month);
}

function isLocalBetween(isoStr, from, to) {
  if (!isoStr || !from || !to) return false;
  const d = new Date(isoStr);
  if (isNaN(d)) return false;
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return key >= from && key <= to;
}

function localDateStr(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d)) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function monthLabel(year, month) {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[Number(month) - 1]} ${year}`;
}

function fmtHhMm(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timingRows(year, month, userId, from = null, to = null) {
  const users = userId ? stmts.listUsers.all().filter(u => u.id === userId) : stmts.listUsers.all();
  const recs = stmts.listAllCheckIns.all()
    .filter(r => (!userId || r.user_id === userId) && ((from && to) ? isLocalBetween(r.check_in_at, from, to) : isLocalMonth(r.check_in_at, year, month)));
  const out = [];
  users.forEach(u => {
    const mine = recs.filter(r => r.user_id === u.id);
    if (mine.length === 0) {
      out.push({ username: u.username, office_id: u.office_id, records: [], status: 'No Check-in' });
    } else {
      mine.forEach(r => {
        const active = !r.check_out_at;
        const ms = active ? (Date.now() - new Date(r.check_in_at)) : (new Date(r.check_out_at) - new Date(r.check_in_at));
        out.push({
          username: u.username,
          office_id: u.office_id,
          records: [{ date: localDateStr(r.check_in_at), in: r.check_in_at, out: r.check_out_at, ms: ms > 0 ? ms : 0, active }],
          status: active ? 'Active' : 'Present'
        });
      });
    }
  });
  return out;
}

function timingTablePdf(doc, subtitle, rows) {
  doc.addPage({ size: 'A4', layout: 'portrait' });
  doc.rect(0, 0, doc.page.width, 50).fill(NAVY);
  doc.fill(GOLD).fontSize(16).font('BanglaBold').text('Office Timing Report', 40, 15);
  doc.fill('#FFFFFF').fontSize(10).font('Bangla').text(subtitle, 40, 35);

  const left = 40;
  const tableW = doc.page.width - 80;
  const SL = 30, DATE = 70, EMP = 120, CIN = 65, COUT = 65, DUR = 65, ST = 60;
  const colDefs = [['SL', SL], ['DATE', DATE], ['EMPLOYEE', EMP], ['CHECK IN', CIN], ['CHECK OUT', COUT], ['DURATION', DUR], ['STATUS', ST]];
  const colX = [];
  let acc = left;
  colDefs.forEach(([, w]) => { colX.push(acc); acc += w; });
  const headerH = 24, BASE_ROW = 20;

  function drawHeader(yy) {
    doc.rect(left, yy, tableW, headerH).fill(NAVY);
    doc.font('BanglaBold').fontSize(8).fill(GOLD);
    colDefs.forEach(([t], i) => doc.text(t, colX[i] + 3, yy + 7, { width: colDefs[i][1] - 6 }));
  }

  drawHeader(64);
  let yy = 64 + headerH;

  if (rows.length === 0) {
    doc.font('Bangla').fontSize(11).fillColor('#666').text('No check-in records for this period.', 40, yy + 10);
    return;
  }

  rows.forEach((r, idx) => {
    const nameText = `${r.username}\n${r.office_id || ''}`;
    const nameH = doc.font('Bangla').fontSize(8).heightOfString(nameText, { width: EMP - 8 });
    const rh = Math.max(BASE_ROW, nameH + 6);

    if (yy + rh > doc.page.height - 40) {
      doc.addPage({ size: 'A4', layout: 'portrait' });
      drawHeader(40);
      yy = 40 + headerH;
    }

    function cell(x, w) {
      doc.rect(x, yy, w, rh).strokeColor('#D8DCE3').lineWidth(0.4).stroke();
    }

    cell(colX[0], SL);
    doc.font('BanglaBold').fontSize(9).fillColor('#222').text(String(idx + 1), colX[0], yy + rh / 2 - 4, { width: SL, align: 'center' });

    cell(colX[1], DATE);
    if (r.records.length) {
      doc.font('Bangla').fontSize(8.5).fillColor('#222').text(r.records[0].date || '', colX[1], yy + rh / 2 - 4, { width: DATE, align: 'center' });
    }

    cell(colX[2], EMP);
    doc.font('BanglaBold').fontSize(8).fillColor('#222').text(r.username, colX[2] + 4, yy + (rh - nameH) / 2, { width: EMP - 8 });
    if (r.office_id) {
      doc.font('Bangla').fontSize(7).fillColor('#666').text(r.office_id, colX[2] + 4, yy + (rh - nameH) / 2 + 10, { width: EMP - 8 });
    }

    cell(colX[3], CIN);
    if (r.records.length) {
      const t = new Date(r.records[0].in);
      doc.font('Bangla').fontSize(8.5).fillColor('#222')
        .text(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), colX[3], yy + rh / 2 - 4, { width: CIN, align: 'center' });
    }

    cell(colX[4], COUT);
    if (r.records.length && r.records[0].out) {
      const t = new Date(r.records[0].out);
      doc.font('Bangla').fontSize(8.5).fillColor('#222')
        .text(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), colX[4], yy + rh / 2 - 4, { width: COUT, align: 'center' });
    } else if (r.records.length) {
      doc.font('Bangla').fontSize(8.5).fillColor('#888').text('—', colX[4], yy + rh / 2 - 4, { width: COUT, align: 'center' });
    }

    cell(colX[5], DUR);
    if (r.records.length) {
      doc.font('BanglaBold').fontSize(8.5).fillColor('#222')
        .text(fmtHhMm(r.records[0].ms), colX[5], yy + rh / 2 - 4, { width: DUR, align: 'center' });
    }

    cell(colX[6], ST);
    if (r.status === 'No Check-in') {
      doc.font('Bangla').fontSize(8).fillColor('#CC5555').text('No Check-in', colX[6], yy + rh / 2 - 4, { width: ST, align: 'center' });
    } else {
      doc.font('BanglaBold').fontSize(8).fillColor(r.active ? '#3DD68C' : '#1155cc').text(r.status, colX[6], yy + rh / 2 - 4, { width: ST, align: 'center' });
    }
    yy += rh;
  });

  if (yy + 26 > doc.page.height - 40) { doc.addPage({ size: 'A4', layout: 'portrait' }); yy = 50; }
  yy += 6;
  doc.rect(left, yy, tableW, BASE_ROW).fill('#F5F6F8');
  doc.rect(left, yy, tableW, BASE_ROW).strokeColor('#D8DCE3').lineWidth(0.4).stroke();
  const presentCount = rows.filter(r => r.records.length).length;
  const noShow = rows.length - presentCount;
  doc.font('BanglaBold').fontSize(9).fill(NAVY)
    .text(`TOTAL: ${presentCount} present / ${noShow} no check-in`, left + 8, yy + 5, { width: tableW - 200 });
}

function timingReportPdf(year, month, userId, from = null, to = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    registerBangla(doc);

    doc.rect(0, 0, doc.page.width, 60).fill(NAVY);
    doc.fill(GOLD).fontSize(22).font('BanglaBold').text('MICROBOSS', 40, 15);
    doc.fill('#FFFFFF').fontSize(11).font('Bangla').text('Office Timing Report', 40, 42);
    doc.fillColor('#8B94A7').fontSize(9)
      .text(`Generated: ${nowIso().slice(0, 16).replace('T', ' ')}`, doc.page.width - 200, 20, { width: 160, align: 'right' });

    const who = userId ? (stmts.findUserById.get(userId) || {}).username : 'All Users';
    const subtitle = (from && to) ? `${who} — ${from} → ${to}` : `${who} — ${monthLabel(year, month)}`;
    let y = 80;
    doc.fill(NAVY).fontSize(16).font('Bangla').text(subtitle, 40, y);
    y += 26;
    doc.font('Bangla').fontSize(10).fill('#444')
      .text('প্রতিটি ইউজারের চেক-ইন/চেক-আউট সময় ও মোট কাজের সময়', 40, y, { width: doc.page.width - 80 });

    timingTablePdf(doc, subtitle, timingRows(year, month, userId, from, to));
    doc.end();
  });
}

/* ============ ARCHIVE EXPORT ============ */

function timeLabel(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

function archiveRow(c) {
  const others = [
    ['Instagram', c.instagram], ['Threads', c.threads], ['X', c.x], ['TikTok', c.tiktok],
    ['Bluesky', c.bluesky], ['Reddit', c.reddit], ['Pinterest', c.pinterest], ['Dailymotion', c.dailymotion]
  ].filter(([, v]) => v && String(v).trim()).map(([label, url]) => `${label}: ${String(url).trim()}`);
  return {
    date: c.upload_date || '',
    uploadedBy: c.uploaded_by_name || '',
    slot: c.slot_label || timeLabel(c.upload_time),
    headline: c.headline || c.slug || '',
    fb: c.facebook || '',
    yt: c.youtube || '',
    others: others.join('\n'),
    sponsor: c.sponsor_name || ''
  };
}

function archiveExportPdf(contents, subtitle) {
  const rows = contents.map(archiveRow);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    registerBangla(doc);

    const tablePage = () => doc.addPage({ size: 'A4', layout: 'landscape' });

    doc.rect(0, 0, doc.page.width, 50).fill(NAVY);
    doc.fill(GOLD).fontSize(16).font('BanglaBold').text('ARCHIVE — Content List', 40, 13);
    doc.fill('#FFFFFF').fontSize(10).font('Bangla').text(subtitle, 40, 34);
    doc.fillColor('#8B94A7').fontSize(9)
      .text(`Generated: ${nowIso().slice(0, 16).replace('T', ' ')}`, doc.page.width - 200, 12, { width: 160, align: 'right' });

    const left = 40;
    const tableW = doc.page.width - 80;
    const SL = 26, DATE = 56, UP = 70, SLOT = 44, HEAD = 160, SPON = 62, LINK_REM = tableW - SL - DATE - UP - SLOT - HEAD - SPON;
    const FB = Math.round(LINK_REM * 0.28), YT = Math.round(LINK_REM * 0.28), OTH = LINK_REM - FB - YT;
    const colDefs = [['SL', SL], ['DATE', DATE], ['UPLOADED BY', UP], ['SLOT', SLOT], ['HEADLINE', HEAD], ['FB LINK', FB], ['YT LINK', YT], ['OTHERS LINK', OTH], ['SPONSOR', SPON]];
    const colX = [];
    let acc = left;
    colDefs.forEach(([, w]) => { colX.push(acc); acc += w; });

    const headerH = 26, BASE_ROW = 20;

    function drawHeader(yy) {
      doc.rect(left, yy, tableW, headerH).fill(NAVY);
      doc.font('BanglaBold').fontSize(7).fill(GOLD);
      colDefs.forEach(([t], i) => doc.text(t, colX[i] + 3, yy + 6, { width: colDefs[i][1] - 6 }));
    }

    drawHeader(58);
    let yy = 58 + headerH;

    function textH(fontName, size, text, width) {
      doc.font(fontName).fontSize(size);
      return Math.ceil(doc.heightOfString(text || '', { width }));
    }

    rows.forEach((r, idx) => {
      const headText = r.headline || '—';
      const headH = textH('Bangla', 8.5, headText, HEAD - 8);
      const upH = textH('Bangla', 8, r.uploadedBy, UP - 8);
      const fbH = textH('Bangla', 6.5, r.fb, FB - 6);
      const ytH = textH('Bangla', 6.5, r.yt, YT - 6);
      const othH = textH('Bangla', 6.5, r.others, OTH - 6);
      const spH = textH('Bangla', 8, r.sponsor, SPON - 8);
      const rh = Math.max(BASE_ROW, headH + 5, upH + 5, fbH + 5, ytH + 5, othH + 5, spH + 5);

      if (yy + rh > doc.page.height - 30) { tablePage(); drawHeader(30); yy = 30 + headerH; }

      function cell(x, w) {
        doc.rect(x, yy, w, rh).strokeColor('#D8DCE3').lineWidth(0.4).stroke();
      }

      cell(colX[0], SL);
      doc.font('BanglaBold').fontSize(9).fillColor('#222').text(String(idx + 1), colX[0], yy + rh / 2 - 4, { width: SL, align: 'center' });
      cell(colX[1], DATE);
      doc.font('Bangla').fontSize(8).fillColor('#555').text(r.date, colX[1], yy + rh / 2 - 4, { width: DATE, align: 'center' });
      cell(colX[2], UP);
      doc.font('Bangla').fontSize(8).fillColor('#333').text(r.uploadedBy, colX[2] + 4, yy + (rh - upH) / 2, { width: UP - 8 });
      cell(colX[3], SLOT);
      doc.font('Bangla').fontSize(8).fillColor('#555').text(r.slot, colX[3] + 4, yy + (rh - upH) / 2, { width: SLOT - 8 });
      cell(colX[4], HEAD);
      doc.font('Bangla').fontSize(8.5).fillColor('#222').text(headText, colX[4] + 4, yy + (rh - headH) / 2, { width: HEAD - 8 });

      const linkCell = (i, text, h) => {
        cell(colX[i], colDefs[i][1]);
        doc.font('Bangla').fontSize(6.5).fillColor(text && /^https?:/i.test(text) ? '#1155cc' : '#CCC')
          .text(text ? stripUrl(text.split('\n')[0]) : '', colX[i] + 3, yy + (rh - h) / 2, { width: colDefs[i][1] - 6, ellipsis: true });
      };
      linkCell(5, r.fb, fbH);
      linkCell(6, r.yt, ytH);

      cell(colX[7], OTH);
      doc.font('Bangla').fontSize(6.5).fillColor(r.others ? '#1155cc' : '#CCC')
        .text(r.others ? r.others.split('\n').map(l => l.replace(/^[^:]+:\s*/, '').replace(/https?:\/\//i, '')).join('\n') : '', colX[7] + 3, yy + (rh - othH) / 2, { width: OTH - 6 });

      cell(colX[8], SPON);
      doc.font('Bangla').fontSize(8).fillColor('#333').text(r.sponsor, colX[8] + 4, yy + (rh - spH) / 2, { width: SPON - 8 });

      yy += rh;
    });

    if (yy + 26 > doc.page.height - 30) { tablePage(); yy = 30; }
    yy += 6;
    doc.rect(left, yy, tableW, BASE_ROW).fill('#F5F6F8');
    doc.rect(left, yy, tableW, BASE_ROW).strokeColor('#D8DCE3').lineWidth(0.4).stroke();
    doc.font('BanglaBold').fontSize(9).fill(NAVY)
      .text(`TOTAL CONTENTS: ${rows.length}`, left + 8, yy + 5);
    doc.end();
  });
}

function xmlEscape(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

function archiveExportExcel(contents, subtitle) {
  const rows = contents.map(archiveRow);
  const headers = ['SL', 'DATE', 'UPLOADED BY', 'SLOT', 'HEADLINE', 'FB LINK', 'YT LINK', 'OTHERS LINK', 'SPONSOR'];
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Archive"><Table>';
  xml += '<Row>' + headers.map(h => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('') + '</Row>';
  rows.forEach((r, i) => {
    const href = u => (u && /^https?:/i.test(u) && !u.includes('\n')) ? ` ss:HRef="${xmlEscape(u)}"` : '';
    const cells = [
      String(i + 1), r.date, r.uploadedBy, r.slot, r.headline, r.fb, r.yt, r.others, r.sponsor
    ];
    xml += '<Row>' + cells.map((c, j) => `<Cell${(j === 5 || j === 6) ? href(c) : ''}><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`).join('') + '</Row>';
  });
  xml += '</Table></Worksheet></Workbook>';
  return xml;
}

function timingReportCsv(year, month, userId, from = null, to = null) {
  const rows = timingRows(year, month, userId, from, to);
  const header = 'SL,Date,Employee,Office ID,Check In,Check Out,Duration (HH:MM),Duration (min),Status';
  const lines = rows.map((r, i) => {
    if (!r.records.length) {
      return [i + 1, '', r.username, r.office_id, '', '', '', '', r.status].map(csvEscape).join(',');
    }
    const rec = r.records[0];
    const t = x => (x ? new Date(x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
    return [i + 1, rec.date || '', r.username, r.office_id, t(rec.in), t(rec.out), fmtHhMm(rec.ms), String(Math.round(rec.ms / 60000)), r.status].map(csvEscape).join(',');
  });
  return '\uFEFF' + header + '\n' + lines.join('\n') + '\n';
}

module.exports = { sponsorPdf, allSponsorsPdf, sponsorReportPdf, employeeReportPdf, sponsorReportCsv, employeeReportCsv, timingReportPdf, timingReportCsv, slotReportPdf, slotReportCsv, archiveExportPdf, archiveExportExcel };