// Buyurtmani bazaga saqlab, keyin Telegram'ga yuboruvchi Netlify funksiyasi.
// Kalitlar faqat muhit o'zgaruvchilaridan olinadi:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
//   hostingda: PGHOST, PGDATABASE, PGUSER, PGPASSWORD; Netlify'da: SUPABASE_URL, SUPABASE_SECRET_KEY
// Jadval: supabase/buyurtmalar.sql (hostingda netlify/lib/db.js o'zi yaratadi)

const db = require('../lib/db');
const i18n = require('../lib/i18n');

// Narxlar serverda saqlanadi — brauzerdan kelgan narxga ishonilmaydi.
// Hostingda narx bazadagi "menyu" jadvalidan olinadi; bu ro'yxat Netlify'da va baza javob bermaganda ishlatiladi.
// index.html dagi data-price qiymatlari bilan bir xil bo'lishi kerak.
const MENU = {
  'Burger': 39000,
  'Chizburger': 42000,
  'Bigchizburger': 49000,
  'Lavash': 36000,
  'Tandir lavash': 43000,
  'Klab sendvich': 45000,
  'Pitsa Peperoni': 105000,
  'Moxito': 55000,
  'Coca-Cola': 20000,
  'Fanta': 20000,
  'Limon choy': 30000,
  'Qahva': 10000,
};

const LIMITS = { name: 60, phone: 20, note: 300, items: 30, qty: 50, body: 5000 };
const MIN_FILL_MS = 3000;      // formani 3 soniyadan tez to'ldirish — bot belgisi
const RATE_WINDOW_MS = 60000;  // bitta IP dan daqiqasiga
const RATE_MAX = 3;            // ko'pi bilan 3 ta buyurtma
const DB_TIMEOUT_MS = 5000;    // menyu narxlarini kutish

// Oddiy xotiradagi cheklov (funksiya "issiq" turganda ishlaydi).
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_MAX;
}

function reply(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data),
  };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function som(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
}

function clean(v) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}

// Buyurtmani bazaga yozadi (hostingda PostgreSQL, Netlify'da Supabase — netlify/lib/db.js).
// Xato bo'lsa faqat logga yoziladi — Telegram'ga yuborish to'xtamaydi.
async function saveOrder(row) {
  try {
    await db.saveOrder(row);
  } catch (e) {
    console.error('Buyurtma bazaga saqlanmadi:', e.message);
  }
}

// Hostingda savatdagi taomlarning bazadagi narxi va mavjudligi; baza javob bermasa null.
async function dbPrices(names) {
  let timer;
  try {
    return await Promise.race([
      db.menuPrices(names),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('vaqt tugadi')), DB_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    console.error('Menyu narxlari olinmadi:', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return reply(405, { ok: false, error: "Ruxsat etilmagan so'rov" });
  }

  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) {
    // Qaysi o'zgaruvchi yetishmayotgani Netlify funksiya loglarida ko'rinadi.
    const missing = [!token && 'TELEGRAM_BOT_TOKEN', !chatId && 'TELEGRAM_CHAT_ID'].filter(Boolean);
    console.error('Muhit o\'zgaruvchisi topilmadi:', missing.join(', '));
    return reply(500, { ok: false, error: 'Buyurtma yuborilmadi', code: 'NO_' + missing.join('_AND_') });
  }

  if (!event.body || event.body.length > LIMITS.body) {
    return reply(400, { ok: false, error: "So'rov noto'g'ri" });
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return reply(400, { ok: false, error: "So'rov noto'g'ri" });
  }

  // Ruscha sahifadan kelgan buyurtma: javob xabarlari ruscha, Telegram'da «🌐 RU» qatori.
  const til = data.til === 'ru' ? 'ru' : 'uz';
  const fail = (statusCode, msg, vars, code) =>
    reply(statusCode, { ok: false, error: i18n.serverMatn(til, msg, vars), ...(code ? { code } : {}) });

  // Spamdan himoya: yashirin maydon to'ldirilgan yoki forma juda tez yuborilgan
  if (data.website || !(Number(data.elapsed) >= MIN_FILL_MS)) {
    return fail(400, "So'rov rad etildi");
  }

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'noma\'lum';
  if (rateLimited(ip)) {
    return fail(429, "Juda ko'p so'rov. Birozdan keyin urinib ko'ring");
  }

  const name = clean(data.name);
  const phone = clean(data.phone);
  const note = clean(data.note);
  const digits = phone.replace(/\D/g, '');

  if (name.length < 2 || name.length > LIMITS.name) {
    return fail(400, "Ismni to'g'ri kiriting");
  }
  if (phone.length > LIMITS.phone || !/^[+\d\s()-]+$/.test(phone) || digits.length < 9 || digits.length > 15) {
    return fail(400, "Telefon raqamini to'g'ri kiriting");
  }
  if (note.length < 3 || note.length > LIMITS.note) {
    return fail(400, "Manzil yoki izoh 3 dan 300 belgigacha bo'lishi kerak");
  }

  if (data.consent !== true) {
    return fail(400, "Ma'lumotlardan foydalanishga rozilik berilmagan");
  }

  // Stol raqami ixtiyoriy (sahifa ?stol=N bilan ochilganda keladi): 1–99.
  let stol = null;
  if (data.stol !== undefined && data.stol !== null && data.stol !== '') {
    const s = String(data.stol).trim();
    stol = /^\d{1,2}$/.test(s) ? Number(s) : 0;
    if (stol < 1 || stol > 99) {
      return fail(400, "Stol raqami noto'g'ri");
    }
  }

  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length || items.length > LIMITS.items) {
    return fail(400, "Savat bo'sh");
  }

  // Hostingda narxlar bazadan; baza javob bermasa — yuqoridagi MENU va xabarda ogohlantirish.
  let prices = null;
  let unchecked = false;
  if (db.usingPg) {
    prices = await dbPrices(items.map((it) => clean(it && it.name)));
    unchecked = !prices;
  }

  let total = 0;
  const lines = [];
  const taomlar = [];
  for (const it of items) {
    const itemName = clean(it && it.name);
    const qty = Number(it && it.qty);
    let price = MENU[itemName];
    if (prices) {
      const row = prices.get(itemName);
      if (row && !row.mavjud) {
        const nomi = til === 'ru' && row.nomi_ru ? row.nomi_ru : itemName;
        return fail(400, '«{nomi}» tugagan. Uni savatdan olib tashlang', { nomi });
      }
      price = row ? row.narx : undefined;
    }
    // Sayt narx yubormaydi; so'rovga narx qo'shilgan va u menyudagidan farq qilsa — rad etiladi.
    const sentPrice = it && (it.price !== undefined ? it.price : it.narx);
    if (
      !price || !Number.isInteger(qty) || qty < 1 || qty > LIMITS.qty ||
      (sentPrice !== undefined && Number(sentPrice) !== price)
    ) {
      return fail(400, "Savatda noto'g'ri taom bor");
    }
    total += price * qty;
    taomlar.push({ nom: itemName, soni: qty, narx: price });
    lines.push(`• ${esc(itemName)} — ${qty} × ${som(price)} = ${som(price * qty)}`);
  }

  const sentTotal = data.total !== undefined ? data.total : data.jami;
  if (sentTotal !== undefined && Number(sentTotal) !== total) {
    return fail(400, "Savatda noto'g'ri taom bor");
  }

  await saveOrder({
    ism: name,
    telefon: phone,
    izoh: note,
    taomlar,
    jami: total,
    rozilik: true,
    stol,
    til,
  });

  const text = [
    '🍔 <b>Yangi buyurtma</b>',
    ...(stol ? [`🪑 <b>Stol ${stol}</b>`] : []),
    ...(til === 'ru' ? ['🌐 RU'] : []),
    ...(unchecked ? ['⚠️ Narxlar tekshirilmadi (baza javob bermadi)'] : []),
    '',
    lines.join('\n'),
    '',
    `<b>Jami:</b> ${som(total)}`,
    '',
    `👤 <b>Ism:</b> ${esc(name)}`,
    `📞 <b>Telefon:</b> ${esc(phone)}`,
    `📍 <b>Manzil / izoh:</b> ${esc(note)}`,
  ].join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) {
      console.error('Telegram xatosi:', res.status, out.description);
      // Telegram javobi (masalan, "chat not found") maxfiy emas — sababni topish uchun qaytariladi.
      return fail(502, 'Buyurtma yuborilmadi', null, `TG_${res.status}: ${out.description || 'noma\'lum'}`);
    }
  } catch (e) {
    console.error('Telegram bilan aloqa yo\'q:', e.message);
    return fail(502, 'Buyurtma yuborilmadi', null, 'TG_NETWORK');
  }

  return reply(200, { ok: true });
};
