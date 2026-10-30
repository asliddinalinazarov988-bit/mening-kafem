// Buyurtma funksiyasi (netlify/functions/order.js): noto'g'ri buyurtmalar rad etiladi.
// Telegram va baza soxta (test/yordam/soxta.js) — hech narsa haqiqiy chatga yoki bazaga yozilmaydi.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require('./yordam/soxta');
const { fetchlar, baza } = globalThis.soxta;

const ROOT = path.join(__dirname, '..');
const MODULLAR = ['netlify/functions/order.js', 'netlify/lib/db.js'].map((f) => path.join(ROOT, f));

// order.js ni toza holda yuklaydi: pgBilan — hostingdagidek (narx bazadan), aks holda Netlify'dagidek (MENU).
function yukla(pgBilan) {
  for (const f of MODULLAR) delete require.cache[f];
  for (const k of ['PGDATABASE', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY']) delete process.env[k];
  if (pgBilan) process.env.PGDATABASE = 'soxta';
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_CHAT_ID = '1';
  return require(MODULLAR[0]);
}

let ipSoni = 0;
function buyurtma(order, ozgartir) {
  const data = {
    name: 'Ali Valiyev',
    phone: '+998 90 123 45 67',
    note: 'Termiz, 5-uy',
    consent: true,
    elapsed: 10000,
    items: [{ name: 'Burger', qty: 2 }, { name: 'Coca-Cola', qty: 1 }],
    ...ozgartir,
  };
  // Har so'rov boshqa IP'dan — daqiqasiga 3 ta cheklovi testga xalaqit bermasin.
  return order.handler({
    httpMethod: 'POST',
    headers: { 'x-forwarded-for': `10.0.0.${++ipSoni}` },
    body: JSON.stringify(data),
  });
}

function telegramlar() {
  return fetchlar.filter((f) => f.url.startsWith('https://api.telegram.org/'));
}

async function radEtiladi(order, ozgartir, xato) {
  const oldin = telegramlar().length;
  const r = await buyurtma(order, ozgartir);
  assert.equal(r.statusCode, 400, r.body);
  const body = JSON.parse(r.body);
  assert.equal(body.ok, false);
  if (xato) assert.equal(body.error, xato);
  assert.equal(telegramlar().length, oldin, 'rad etilgan buyurtma Telegram\'ga yuborilmasligi kerak');
}

for (const pgBilan of [false, true]) {
  const nom = pgBilan ? 'hosting (narx bazadan)' : 'Netlify (narx MENU dan)';

  test(`${nom}: to'g'ri buyurtma qabul qilinadi`, async () => {
    const order = yukla(pgBilan);
    const oldin = telegramlar().length;
    const r = await buyurtma(order);
    assert.equal(r.statusCode, 200, r.body);
    const tg = telegramlar();
    assert.equal(tg.length, oldin + 1);
    assert.ok(tg.at(-1).url.includes('/bottest-token/'), 'faqat soxta token ishlatiladi');
    const text = JSON.parse(tg.at(-1).body).text;
    assert.ok(text.includes("98 000 so'm"), text); // 2 × 39 000 + 20 000
  });

  test(`${nom}: bo'sh ism rad etiladi`, async () => {
    const order = yukla(pgBilan);
    await radEtiladi(order, { name: '' }, "Ismni to'g'ri kiriting");
    await radEtiladi(order, { name: '   ' }, "Ismni to'g'ri kiriting");
  });

  test(`${nom}: noto'g'ri telefon rad etiladi`, async () => {
    const order = yukla(pgBilan);
    for (const phone of ['', '123', 'telefon raqam', '+998 90 abc 45 67', '1'.repeat(16)]) {
      await radEtiladi(order, { phone }, "Telefon raqamini to'g'ri kiriting");
    }
  });

  test(`${nom}: menyuda yo'q taom rad etiladi`, async () => {
    const order = yukla(pgBilan);
    await radEtiladi(order, { items: [{ name: 'Shaurma', qty: 1 }] }, "Savatda noto'g'ri taom bor");
    await radEtiladi(order, { items: [{ name: 'Burger', qty: 1 }, { name: 'Yo\'q taom', qty: 1 }] }, "Savatda noto'g'ri taom bor");
    await radEtiladi(order, { items: [] }, "Savat bo'sh");
  });

  test(`${nom}: o'zgartirilgan narx rad etiladi`, async () => {
    const order = yukla(pgBilan);
    await radEtiladi(order, { items: [{ name: 'Burger', qty: 1, price: 1000 }] }, "Savatda noto'g'ri taom bor");
    await radEtiladi(order, { items: [{ name: 'Burger', qty: 1, narx: 0 }] }, "Savatda noto'g'ri taom bor");
    await radEtiladi(order, { total: 1000 }, "Savatda noto'g'ri taom bor");
    await radEtiladi(order, { items: [{ name: 'Burger', qty: 0 }] }, "Savatda noto'g'ri taom bor");
    await radEtiladi(order, { items: [{ name: 'Burger', qty: 1.5 }] }, "Savatda noto'g'ri taom bor");
  });
}

test('hosting: narx bazadan olinadi, tugagan taom rad etiladi', async () => {
  const order = yukla(true);
  await buyurtma(order); // baza to'ldirilsin
  const burger = baza.menyu.find((r) => r.nomi === 'Burger');
  burger.narx = 41000;
  try {
    const r = await buyurtma(order, { items: [{ name: 'Burger', qty: 1 }] });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(JSON.parse(telegramlar().at(-1).body).text.includes("41 000 so'm"));
    // Eski (39 000) narx bilan kelgan so'rov rad etiladi.
    await radEtiladi(order, { items: [{ name: 'Burger', qty: 1, price: 39000 }] }, "Savatda noto'g'ri taom bor");

    burger.mavjud = false;
    await radEtiladi(order, { items: [{ name: 'Burger', qty: 1 }] }, '«Burger» tugagan. Uni savatdan olib tashlang');
  } finally {
    burger.narx = 39000;
    burger.mavjud = true;
  }
});

test('ruscha buyurtmada xato ruscha qaytadi', async () => {
  const order = yukla(false);
  const r = await buyurtma(order, { til: 'ru', name: '' });
  assert.equal(r.statusCode, 400);
  assert.match(JSON.parse(r.body).error, /[А-яЁё]/);
});

test('haqiqiy Telegram va bazaga so\'rov ketmadi', () => {
  for (const f of fetchlar) {
    assert.ok(f.url.startsWith('https://api.telegram.org/bottest-token/'), f.url);
  }
});
