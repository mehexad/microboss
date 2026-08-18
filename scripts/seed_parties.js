const path = require('path');
const { db } = require(path.join(__dirname, '..', 'lib', 'db.js'));

const PARTIES = [
  {
    name: 'BNP',
    pages: [
      { name: 'BNP Bangladesh', url: 'https://www.facebook.com/bnpbd.org' },
      { name: 'BNP Media Cell', url: 'https://www.facebook.com/bnpbd78' },
    ],
  },
  {
    name: 'NCP',
    pages: [
      { name: 'National Citizen Party', url: 'https://www.facebook.com/1NationalCitizenParty' },
      { name: 'NCP Media Cell', url: 'https://www.facebook.com/ConnectNCP' },
    ],
  },
  {
    name: 'AWAMI LEAGUE',
    pages: [
      { name: 'Bangladesh Awami League', url: 'https://www.facebook.com/awamileague.1949' },
    ],
  },
  {
    name: 'BANGLADESH JAMAT E ISLAMI',
    pages: [
      { name: 'Bangladesh Jamaat-e-Islami', url: 'https://www.facebook.com/BJI.Official' },
    ],
  },
];

const findParty = db.prepare('SELECT id, name FROM parties WHERE name = ?');
const createParty = db.prepare('INSERT INTO parties (name, created_at) VALUES (?, ?)');
const findPage = db.prepare('SELECT id FROM party_pages WHERE party_id = ? AND url = ?');
const createPage = db.prepare('INSERT INTO party_pages (party_id, name, url, created_at) VALUES (?, ?, ?, ?)');

for (const p of PARTIES) {
  let party = findParty.get(p.name);
  if (!party) {
    const info = createParty.run(p.name, new Date().toISOString());
    party = { id: info.lastInsertRowid, name: p.name };
    console.log('Party added:', p.name);
  } else {
    console.log('Party exists:', p.name);
  }
  for (const pg of p.pages) {
    if (findPage.get(party.id, pg.url)) {
      console.log('  page exists:', pg.name);
      continue;
    }
    createPage.run(party.id, pg.name, pg.url, new Date().toISOString());
    console.log('  page added:', pg.name, pg.url);
  }
}

const parties = db.prepare('SELECT * FROM parties ORDER BY name').all();
for (const p of parties) {
  const pages = db.prepare('SELECT COUNT(*) n FROM party_pages WHERE party_id = ?').get(p.id).n;
  console.log(`${p.name}: ${pages} pages`);
}
