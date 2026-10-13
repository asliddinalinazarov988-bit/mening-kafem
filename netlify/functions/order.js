// Buyurtmani Supabase'ga saqlab, keyin Telegram'ga yuboruvchi Netlify funksiyasi.
// Kalitlar faqat Netlify muhit o'zgaruvchilaridan olinadi:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SUPABASE_URL, SUPABASE_SECRET_KEY
// Jadval: supabase/buyurtmalar.sql

// Narxlar serverda saqlanadi — brauzerdan kelgan narxga ishonilmaydi.
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

// Buyurtmani Supabase'dagi "buyurtmalar" jadvaliga yozadi.
// Xato bo'lsa faqat logga yoziladi — Telegram'ga yuborish to'xtamaydi.
async function saveOrder(row) {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !key) {
    const missing = [!url && 'SUPABASE_URL', !key && 'SUPABASE_SECRET_KEY'].filter(Boolean);
    console.error('Supabase sozlanmagan, buyurtma saqlanmadi:', missing.join(', '));
    return;
  }
  try {
    const res = await fetch(`${url}/rest/v1/buyurtmalar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        // Eski service_role kaliti (JWT) Authorization'da ham yuboriladi;
        // yangi sb_secret_... kalitlari uchun apikey yetarli.
        ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      console.error('Supabase xatosi:', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.error('Supabase bilan aloqa yo\'q:', e.message);
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

  // Spamdan himoya: yashirin maydon to'ldirilgan yoki forma juda tez yuborilgan
  if (data.website || !(Number(data.elapsed) >= MIN_FILL_MS)) {
    return reply(400, { ok: false, error: "So'rov rad etildi" });
  }

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'noma\'lum';
  if (rateLimited(ip)) {
    return reply(429, { ok: false, error: "Juda ko'p so'rov. Birozdan keyin urinib ko'ring" });
  }

  const name = clean(data.name);
  const phone = clean(data.phone);
  const note = clean(data.note);
  const digits = phone.replace(/\D/g, '');

  if (name.length < 2 || name.length > LIMITS.name) {
    return reply(400, { ok: false, error: 'Ismni to\'g\'ri kiriting' });
  }
  if (phone.length > LIMITS.phone || !/^[+\d\s()-]+$/.test(phone) || digits.length < 9 || digits.length > 15) {
    return reply(400, { ok: false, error: 'Telefon raqamini to\'g\'ri kiriting' });
  }
  if (note.length < 3 || note.length > LIMITS.note) {
    return reply(400, { ok: false, error: "Manzil yoki izoh 3 dan 300 belgigacha bo'lishi kerak" });
  }

  if (data.consent !== true) {
    return reply(400, { ok: false, error: "Ma'lumotlardan foydalanishga rozilik berilmagan" });
  }

  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length || items.length > LIMITS.items) {
    return reply(400, { ok: false, error: "Savat bo'sh" });
  }

  let total = 0;
  const lines = [];
  const taomlar = [];
  for (const it of items) {
    const itemName = clean(it && it.name);
    const qty = Number(it && it.qty);
    const price = MENU[itemName];
    if (!price || !Number.isInteger(qty) || qty < 1 || qty > LIMITS.qty) {
      return reply(400, { ok: false, error: "Savatda noto'g'ri taom bor" });
    }
    total += price * qty;
    taomlar.push({ nom: itemName, soni: qty, narx: price });
    lines.push(`• ${esc(itemName)} — ${qty} × ${som(price)} = ${som(price * qty)}`);
  }

  await saveOrder({
    ism: name,
    telefon: phone,
    izoh: note,
    taomlar,
    jami: total,
    rozilik: true,
  });

  const text = [
    '🍔 <b>Yangi buyurtma</b>',
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
      return reply(502, { ok: false, error: 'Buyurtma yuborilmadi', code: `TG_${res.status}: ${out.description || 'noma\'lum'}` });
    }
  } catch (e) {
    console.error('Telegram bilan aloqa yo\'q:', e.message);
    return reply(502, { ok: false, error: 'Buyurtma yuborilmadi', code: 'TG_NETWORK' });
  }

  return reply(200, { ok: true });
};
