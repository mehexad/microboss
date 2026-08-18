const fs = require('fs');
const http = require('http');
const https = require('https');

const BASE = process.argv[2] || 'https://microboss.onrender.com';
const USERNAME = process.argv[3];
const PASSWORD = process.argv[4];

if (!USERNAME || !PASSWORD) {
  console.error('Usage: node scripts/import_captions.js <base_url> <username> <password>');
  console.error('Example: node scripts/import_captions.js https://microboss.onrender.com myuser mypass');
  process.exit(1);
}

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (cookie) opts.headers['Cookie'] = cookie;
    const req = mod.request(opts, res => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), cookie: setCookie }); }
        catch (e) { resolve({ status: res.statusCode, body: data, cookie: setCookie }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. Login
  console.log('Logging in as', USERNAME, '...');
  const loginRes = await request('POST', '/api/login', { identifier: USERNAME, password: PASSWORD });
  if (loginRes.status !== 200 || !loginRes.body.user) {
    console.error('Login failed:', loginRes.body);
    process.exit(1);
  }
  console.log('Logged in as', loginRes.body.user.username, '(' + loginRes.body.user.role + ')');
  const sessionCookie = loginRes.cookie ? loginRes.cookie[0].split(';')[0] : '';

  // 2. Load captions
  const captions = JSON.parse(fs.readFileSync(__dirname + '/../data/captions_export.json', 'utf8'));
  console.log('Found', captions.length, 'captions to import');

  // 3. Import each caption
  let ok = 0, fail = 0;
  for (const c of captions) {
    try {
      const res = await request('POST', '/api/captions', {
        category: c.category,
        caption: c.caption,
        description: c.description || '',
        keywords: c.keywords || '',
        tags: c.tags || '',
        hashtag: c.hashtag || '',
        minister_name: c.minister_name || ''
      }, sessionCookie);
      if (res.status === 200 && res.body.ok) {
        ok++;
        process.stdout.write('.');
      } else {
        fail++;
        console.error('\nFailed:', c.caption.substring(0, 50), '-', res.status, JSON.stringify(res.body));
      }
    } catch (e) {
      fail++;
      console.error('\nError:', c.caption.substring(0, 50), '-', e.message);
    }
  }

  console.log('\nDone! Imported:', ok, '/ Failed:', fail);
}

main().catch(e => { console.error(e); process.exit(1); });
