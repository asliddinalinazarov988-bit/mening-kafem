// server.js bazasiz va Telegram'siz ishga tushadi (test/yordam/soxta.js — soxta baza va fetch),
// sahifalar ochilishi va ularda Metrika, hreflang va asosiy bo'limlar borligi tekshiriladi.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const METRIKA = 'mc.yandex.ru/watch/113894435';
let server;
let base;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

async function get(p) {
  const res = await fetch(base + p, { redirect: 'manual' });
  return { status: res.status, type: res.headers.get('content-type') || '', text: await res.text() };
}

test.before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  // Faqat kerakli o'zgaruvchilar — CI'dagi haqiqiy kalitlar serverga berilmaydi.
  server = spawn(process.execPath, ['-r', './test/yordam/soxta.js', 'server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      PGDATABASE: 'soxta',
      ADMIN_PAROL: 'test-parol-12345',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Server ishga tushmadi:\n' + log);
    try {
      await fetch(base + '/');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('Server javob bermadi:\n' + log);
});

test.after(() => {
  if (server) server.kill();
});

function sahifaTekshir(r, lang) {
  assert.equal(r.status, 200);
  assert.match(r.type, /text\/html/);
  assert.ok(r.text.includes(`<html lang="${lang}"`), `lang="${lang}" yo'q`);
  assert.ok(r.text.includes(METRIKA), 'Metrika (noscript) yo\'q');
  assert.ok(r.text.includes('ym(113894435'), 'Metrika kodi yo\'q');
  for (const h of ['uz', 'ru', 'x-default']) {
    assert.match(r.text, new RegExp(`<link rel="alternate" hreflang="${h}" href="https://burgersmash\\.uz/`), `hreflang="${h}" yo'q`);
  }
  assert.match(r.text, /<link rel="canonical"/);
}

function bolimlar(text) {
  for (const s of ['class="hero"', 'id="menyu"', 'id="qulayliklar"', 'id="band-qilish"', 'data-til="uz"', 'data-til="ru"']) {
    assert.ok(text.includes(s), `${s} bo'limi yo'q`);
  }
}

test('/ — o\'zbekcha bosh sahifa', async () => {
  const r = await get('/');
  sahifaTekshir(r, 'uz');
  bolimlar(r.text);
  assert.ok(r.text.includes('<title>American — Fast Food</title>'));
});

test('/ru/ — ruscha bosh sahifa', async () => {
  for (const p of ['/ru/', '/ru']) {
    const r = await get(p);
    sahifaTekshir(r, 'ru');
    bolimlar(r.text);
    assert.ok(r.text.includes('Меню'));
  }
});

test('/privacy — maxfiylik siyosati', async () => {
  for (const p of ['/privacy', '/privacy.html']) {
    const r = await get(p);
    sahifaTekshir(r, 'uz');
    assert.ok(r.text.includes('Maxfiylik siyosati'));
  }
});

test('/ru/privacy — ruscha maxfiylik siyosati', async () => {
  const r = await get('/ru/privacy');
  sahifaTekshir(r, 'ru');
  assert.match(r.text, /[А-яЁё]{4,}/);
});

test('/admin — kirish sahifasi (Metrikasiz)', async () => {
  const r = await get('/admin');
  assert.equal(r.status, 200);
  assert.match(r.type, /text\/html/);
  assert.ok(r.text.includes('name="parol"'), 'parol maydoni yo\'q');
  assert.ok(!r.text.includes(METRIKA), 'admin sahifada Metrika bo\'lmasligi kerak');
});

test('ish vaqti: har kuni 9:00 – 23:00 (o\'zbekcha va ruscha)', async () => {
  const uz = (await get('/')).text;
  for (const m of ['Bugun ochiq · 9:00 – 23:00', '<b>9:00 – 23:00</b>Har kuni', 'Har kuni 9:00 dan 23:00 gacha', 'h <= 22;']) {
    assert.ok(uz.includes(m), `${m} yo'q`);
  }
  const ru = (await get('/ru/')).text;
  for (const m of ['Сегодня открыто · 9:00 – 23:00', '<b>9:00 – 23:00</b>Ежедневно', 'Ежедневно с 9:00 до 23:00']) {
    assert.ok(ru.includes(m), `${m} yo'q`);
  }
  for (const text of [uz, ru]) assert.ok(!text.includes('22:00'), 'eski ish vaqti (22:00) qolgan');
});

test('menyu ma\'lumoti (/.netlify/functions/menyu)', async () => {
  const r = await get('/.netlify/functions/menyu');
  assert.equal(r.status, 200);
  const data = JSON.parse(r.text);
  assert.equal(data.ok, true);
  assert.equal(data.taomlar.length, 12);
  const burger = data.taomlar.find((t) => t.nomi === 'Burger');
  assert.equal(burger.narx, 39000);
  assert.equal(burger.nomi_ru, 'Бургер');
});

test('sayt menyu javobidagi taomlar va items kalitlarini o\'qiydi', async () => {
  const text = (await get('/')).text;
  assert.ok(text.includes('data.taomlar') && text.includes('data.items'));
});

test('yashirin fayllar berilmaydi', async () => {
  for (const p of ['/server.js', '/package.json', '/CLAUDE.md', '/scripts/ru.js', '/test/yordam/soxta.js', '/netlify/functions/order.js', '/i18n/ru.js', '/.github/workflows/tekshiruv.yml', '/yoq-sahifa']) {
    assert.equal((await get(p)).status, 404, p);
  }
});

test('node scripts/ru.js --check — barcha matnlar tarjima qilingan', () => {
  const r = spawnSync(process.execPath, ['scripts/ru.js', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
