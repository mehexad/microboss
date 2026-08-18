const http = require('http');
const https = require('https');
const { URL } = require('url');

const RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const RESOLVE_TTL_MS = 60 * 60 * 1000;
const FEED_TTL_MS = 3 * 60 * 1000;
const TIMEOUT_MS = 9000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const resolveCache = new Map();
const feedCache = new Map();

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchText(new URL(res.headers.location, url).href).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function clean(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ').trim();
}

function tag(xml, name) {
  const m = xml.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? clean(m[1]) : '';
}

function parseFeed(xml) {
  const out = [];
  const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const e of entries) {
    const videoId = tag(e, 'yt:videoId');
    if (!videoId) continue;
    const title = tag(e, 'media:title') || tag(e, 'title');
    const published = tag(e, 'published');
    const link = (e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) || [])[1] || 'https://www.youtube.com/watch?v=' + videoId;
    if (!title) continue;
    out.push({ title, videoId, published, link, thumb: 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg' });
  }
  return out;
}

function extractChannelId(html) {
  let m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"[^>]*>/i);
  if (!m) m = html.match(/property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/i);
  if (!m) m = html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/);
  if (!m) m = html.match(/<meta itemprop="channelId" content="(UC[A-Za-z0-9_-]{22})">/i);
  if (!m) m = html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/);
  return m ? m[1] : null;
}

async function resolveChannelId(url) {
  const cached = resolveCache.get(url);
  if (cached && Date.now() - cached.at < RESOLVE_TTL_MS) return cached.id;
  let id = null;
  const m = String(url).match(/\/channel\/(UC[A-Za-z0-9_-]{22})/i);
  if (m) {
    id = m[1];
  } else {
    try {
      const html = await fetchText(url);
      id = extractChannelId(html);
    } catch (e) {
      id = null;
    }
  }
  resolveCache.set(url, { id, at: Date.now() });
  return id;
}

async function resolveChannelIdWithFeed(url) {
  const channelId = await resolveChannelId(url);
  if (!channelId) return null;
  try {
    const xml = await fetchText(RSS_URL + channelId);
    const entries = parseFeed(xml);
    return entries.length ? channelId : null;
  } catch (e) {
    return null;
  }
}

async function fetchLatest(url) {
  const cached = feedCache.get(url);
  if (cached && Date.now() - cached.at < FEED_TTL_MS) return cached.latest;
  const channelId = await resolveChannelId(url);
  if (!channelId) {
    feedCache.set(url, { latest: { error: 'Channel not found or not public.' }, at: Date.now() });
    return { error: 'Channel not found or not public.' };
  }
  const xml = await fetchText(RSS_URL + channelId);
  const entries = parseFeed(xml);
  const latest = entries[0] || { error: 'No public videos found on this channel.' };
  feedCache.set(url, { latest, at: Date.now() });
  return latest;
}

async function getOneEye(sources) {
  const out = new Array(sources.length);
  const CHUNK = 4;
  for (let i = 0; i < sources.length; i += CHUNK) {
    const slice = sources.slice(i, i + CHUNK);
    const res = await Promise.allSettled(slice.map(s => fetchLatest(s.url).then(latest => ({ source: s, latest }))));
    res.forEach((r, j) => { out[i + j] = r; });
  }
  return out.map(r => {
    if (r.status !== 'fulfilled') return { id: null, error: 'Fetch failed.' };
    return { id: r.value.source.id, name: r.value.source.name, kind: r.value.source.kind, url: r.value.source.url, latest: r.value.latest || null };
  });
}

module.exports = { resolveChannelId, resolveChannelIdWithFeed, fetchLatest, getOneEye };
