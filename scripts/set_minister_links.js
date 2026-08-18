const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, '..', 'data', 'microboss.db'));

const LINKS = {
  'মির্জা ফখরুল ইসলাম আলমগীর': 'https://www.facebook.com/BNP.MirzaAlamgir/',
  'আমির খসরু মাহমুদ চৌধুরী': 'https://www.facebook.com/AmirKhasruMahmodChowdhury/',
  'সালাহউদ্দিন আহমেদ': 'https://www.facebook.com/salahuddin.a.bnp',
  'ইকবাল হাসান মাহমুদ টুকু': 'https://www.facebook.com/p/%E0%A6%87%E0%A6%95%E0%A6%AC%E0%A6%BE%E0%A6%B2-%E0%A6%B9%E0%A6%BE%E0%A6%B8%E0%A6%BE%E0%A6%A8-%E0%A6%AE%E0%A6%BE%E0%A6%B9%E0%A6%AE%E0%A7%81%E0%A6%A6-%E0%A6%9F%E0%A7%81%E0%A6%95%E0%A7%81-100063837935575/',
  'হাফিজউদ্দিন আহমেদ বীর বিক্রম': 'https://www.facebook.com/hafizuddinahamed/',
  'এ জেড এম জাহিদ হোসেন': 'https://www.facebook.com/professordrazmzahidhossain',
  'আবদুল আউয়াল মিন্টু': 'https://www.facebook.com/abdulawal.mintoo.9/',
  'কাজী শাহ মোফাজ্জল হোসেন কায়কোবাদ': 'https://www.facebook.com/ksmhkaikobad/',
  'মিজানুর রহমান মিনু': 'https://www.facebook.com/mizanur.rahman.minu.bnp',
  'নিতাই রায় চৌধুরী': 'https://www.facebook.com/nitairoy.chowdhury.7/',
  'খন্দকার আবদুল মুক্তাদির': 'https://www.facebook.com/profile.php?id=100066841462685',
  'আরিফুল হক চৌধুরী': 'https://www.facebook.com/ArifulHaqueForSylhet',
  'আফরোজা খানম রিতা': 'https://www.facebook.com/Afroza.Khan.Rita.BNP',
  'দীপেন দেওয়ান': 'https://www.facebook.com/DipenDewan99/',
  'এ এন এম এহসানুল হক মিলন': 'https://www.facebook.com/anm.ehsanul.hoque.milon',
  'সর্দার মো. সাখাওয়াত হোসেন': 'https://www.facebook.com/100085033304933',
  'ফকির মাহবুব আনাম': 'https://www.facebook.com/MahbubAnamShopon',
  'শেখ রাবিউল আলম': 'https://www.facebook.com/rabibnpofficial',
  'মোহাম্মদ আমিন উর রশিদ': 'https://www.facebook.com/MohammedAminUrRashid/',
  'ড. খলিলুর রহমান': '',
  'মো. শহীদ উদ্দিন চৌধুরী এ্যানী': 'https://www.facebook.com/aneebnpmp21',
  'আসাদুল হাবিব দুলু': 'https://www.facebook.com/asadulhabib.dulu.71',
  'মো. আসাদুজ্জামান': '',
  'জাকিয়া তাহের': 'https://www.facebook.com/zakaria.taher.2025',
  'জহির উদ্দিন স্বপন': 'https://www.facebook.com/Zahiruddinswaponbnp',
  'এম রশিদুজ্জামান মিল্লাত': 'https://www.facebook.com/m.rashiduzzamanmillat',
  'অনিন্দ্য ইসলাম অমিত': 'https://www.facebook.com/anindaislamamit',
  'মো. শরিফুল আলম': 'https://www.facebook.com/sharifulalambnp',
  'ফরহাদ হোসেন আজাদ': 'https://www.facebook.com/Forhadhosenazad',
  'শামা ওবায়েদ ইসলাম': 'https://www.facebook.com/ShamaobayedOfficial',
  'সুলতান সালাহউদ্দিন টুকু': 'https://www.facebook.com/tukutangail05',
  'ব্যারিস্টার কায়সার কামাল': 'https://www.facebook.com/BarristerKayserK',
  'মীর মোহাম্মদ হেলাল উদ্দিন': 'https://www.facebook.com/mirmohammedhelaluddin',
  'হাবিবুর রশিদ হাবিব': 'https://www.facebook.com/habibur.rashid.90',
  'মো. রাজিব আহসান': 'https://www.facebook.com/RajibAhsanJCD',
  'মো. আবদুল বারী': 'https://www.facebook.com/abdul.bari.790256',
  'মীর শাহে আলম': 'https://www.facebook.com/ShaheAlamBnp',
  'মো. জোনায়েদ আবদুর রহিম সাকি': 'https://www.facebook.com/zonayed.saki.bd',
  'ইশরাক হোসেন': 'https://www.facebook.com/Vote4.Ishraque',
  'ফারজানা শারমিন পুতুল': 'https://www.facebook.com/profile.php?id=61581664058483',
  'শেখ ফরিদুল ইসলাম': 'https://www.facebook.com/profile.php?id=100067319430383',
  'মো. নুরুল হক নূর': 'https://www.facebook.com/ducsuvpnur',
  'ইয়াসের খান চৌধুরী': 'https://www.facebook.com/Nandailykc/',
  'এম ইকবাল হোসেন': 'https://www.facebook.com/61586292026942',
  'এম এ মুহিত': 'https://www.facebook.com/drmamuhit.official/',
  'আহম্মদ সোহেল মঞ্জুর': 'https://www.facebook.com/Ahammadsohelmonzoor/',
  'ববি হাজ্জাজ': 'https://www.facebook.com/bobby.hajjaj',
  'আলী নেওয়াজ মাহমুদ খায়েম': 'https://www.facebook.com/alinewazmahmood.khyom/',
  'মো. আমিনুল হক': 'https://www.facebook.com/AminulHaque81/',
};

const upd = db.prepare('UPDATE ministers SET fb_link = ? WHERE name = ?');
let ok = 0, miss = 0;
for (const [name, link] of Object.entries(LINKS)) {
  const r = upd.run(link, name);
  if (r.changes) ok++; else { miss++; console.log('NOT FOUND:', name); }
}
console.log(`Links set: ${ok}, Not matched: ${miss}`);
const withLink = db.prepare(`SELECT COUNT(*) n FROM ministers WHERE fb_link != ''`).get();
console.log(`Ministers with link: ${withLink.n} / ${db.prepare('SELECT COUNT(*) n FROM ministers').get().n}`);
