const http = require('http');
const https = require('https');
const { URL } = require('url');

const GNEWS = 'https://news.google.com/rss/search?q=site%3A';
const BN = '+when%3A1d&hl=bn&gl=BD&ceid=BD:bn';
const EN = '+when%3A1d&hl=en&gl=BD&ceid=BD:en';

const FEEDS = [
  { name: 'প্রথম আলো', url: GNEWS + 'prothomalo.com' + BN },
  { name: 'বাংলাদেশ প্রতিদিন', url: GNEWS + 'bd-pratidin.com' + BN },
  { name: 'কালের কণ্ঠ', url: GNEWS + 'kalerkantho.com' + BN },
  { name: 'যুগান্তর', url: GNEWS + 'jugantor.com' + BN },
  { name: 'সমকাল', url: GNEWS + 'samakal.com' + BN },
  { name: 'ইত্তেফাক', url: GNEWS + 'ittefaq.com.bd' + BN },
  { name: 'বাংলা ট্রিবিউন', url: GNEWS + 'banglatribune.com' + BN },
  { name: 'জাগো নিউজ ২৪', url: GNEWS + 'jagonews24.com' + BN },
  { name: 'ঢাকা পোস্ট', url: GNEWS + 'dhakapost.com' + BN },
  { name: 'মানবজমিন', url: GNEWS + 'mzamin.com' + BN },
  { name: 'বিডিনিউজ ২৪', url: GNEWS + 'bdnews24.com' + BN },
  { name: 'The Daily Star', url: GNEWS + 'thedailystar.net' + EN },
  { name: 'ঢাকা ট্রিবিউন', url: GNEWS + 'dhakatribune.com' + BN },
  { name: 'The Financial Express', url: GNEWS + 'thefinancialexpress.com.bd' + EN },
  { name: 'জুম বাংলা', url: 'https://zoombangla.com/feed/' }
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_PER_SOURCE = 5;
const MAX_HEADLINES = 60;
const TIMEOUT_MS = 9000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

let cache = { at: 0, headlines: [] };

function fetchText(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml, text/xml, */*' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchText(new URL(res.headers.location, url).href, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

const JUNK_WORDS = /ভিডিও|গ্যালারি|আর্কাইভ|সংবাদপত্র|নিউজপেপার|লগইন|রেজিস্ট্রেশন|সাবস্ক্রাইব|মোবাইল অ্যাপ|ডাউনলোড|বিজ্ঞাপন|যোগাযোগ|কন্টাক্ট|ইমেইল|সর্বশেষ সংবাদ|ব্রেকিং নিউজ|লেটেস্ট|newspaper|gallery|archive|download|contact|advertise|login|subscribe|tag related all news|ট্যাগ সম্পর্কিত|ট্যাগ|টপ টেন|top ten|শীর্ষ সংবাদ|আজকের শীর্ষ|সেরা খবর|শিরোনাম সংবাদ/i;
const SECTION_WORDS = /^(বিনোদন|সর্বশেষ|আর্কাইভ|খেলা|রাজনীতি|অর্থনীতি|জাতীয়|আন্তর্জাতিক|দেশ|নগর|সম্পাদকীয়|মতামত|লাইফস্টাইল|ফিচার|সাহিত্য|বিজ্ঞান|প্রযুক্তি|শিক্ষা|ইসলাম|প্রবাস|পরিবেশ|স্পোর্টস|ধর্ম|মহানগর|প্রথম পাতা|শেষ পাতা|লাইভ|ভিডিও|গ্যালারি)$/;

function isJunkTitle(title, feedName) {
  const s = title.replace(/\s+/g, ' ').trim();
  if (!s) return true;
  const vis = s.replace(/\s/g, '');
  if (vis.length < 18) return true;
  if (s.includes('|') || s.includes('||')) return true;
  if ((s.match(/\s-\s/g) || []).length >= 2) return true;
  if (feedName && s.toLowerCase().includes(String(feedName).toLowerCase())) return true;
  if (JUNK_WORDS.test(s)) return true;
  if (SECTION_WORDS.test(s)) return true;
  return false;
}

function clean(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(xml, name) {
  const m = xml.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? clean(m[1]) : '';
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseRss(xml, feedName) {
  const out = [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const it of items) {
    let title = tag(it, 'title');
    const link = tag(it, 'link');
    title = title
      .replace(/\s*-\s*[a-z0-9.-]+\.[a-z]{2,}\s*$/i, '')
      .replace(/\s*-\s*[A-Za-z][A-Za-z0-9 .&'-]{0,45}$/, '')
      .replace(new RegExp('\\s*-\\s*' + escapeRe(feedName) + '\\s*$', 'i'), '')
      .replace(new RegExp('^\\s*' + escapeRe(feedName) + '\\s*[-:]\\s*', 'i'), '')
      .trim();
    if (title && link && /^https?:\/\//.test(link)) {
      out.push({ title, link });
    }
  }
  return out;
}

async function getNews() {
  if (cache.headlines.length && Date.now() - cache.at < CACHE_TTL_MS) return cache.headlines;
  const seen = new Set();
  const results = await fetchAllFeeds();
  const capped = results.map(r => {
    if (r.status !== 'fulfilled') return [];
    return r.value.items.filter(h => !isJunkTitle(h.title, r.value.name)).slice(0, MAX_PER_SOURCE);
  });
  const idx = capped.map(() => 0);
  const headlines = [];
  let active = results.length;
  while (headlines.length < MAX_HEADLINES && active > 0) {
    active = 0;
    for (let i = 0; i < capped.length; i++) {
      if (idx[i] >= capped[i].length) continue;
      active++;
      const h = capped[i][idx[i]++];
      const key = h.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      headlines.push({ ...h, source: results[i].value.name });
      if (headlines.length >= MAX_HEADLINES) break;
    }
  }
  cache = { at: Date.now(), headlines };
  return headlines;
}

async function fetchAllFeeds() {
  const out = new Array(FEEDS.length);
  const CHUNK = 4;
  for (let i = 0; i < FEEDS.length; i += CHUNK) {
    const slice = FEEDS.slice(i, i + CHUNK);
    const res = await Promise.allSettled(slice.map(f => fetchText(f.url, TIMEOUT_MS).then(xml => ({ name: f.name, items: parseRss(xml, f.name) }))));
    res.forEach((r, j) => { out[i + j] = r; });
  }
  return out;
}

module.exports = { getNews };
