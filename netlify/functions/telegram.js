// Telegram bot webhook'i (sozlash: /.netlify/functions/telegram-setup).
// Kalitlar faqat Netlify muhit o'zgaruvchilaridan olinadi:
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SUPABASE_URL, SUPABASE_SECRET_KEY
// So'rov faqat X-Telegram-Bot-Api-Secret-Token sarlavhasi to'g'ri bo'lsa qabul qilinadi.
// Buyurtma ma'lumoti faqat TELEGRAM_CHAT_ID dagi chatga beriladi.

const crypto = require('crypto');

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Toshkent: UTC+5, yozgi vaqt yo'q
const PAGE = 1000;                        // Supabase bir so'rovda ko'pi bilan shuncha qator beradi

const COMMANDS_TEXT = [
  '🍔 <b>American Fast Food boti</b>',
  '',
  'Buyruqlar:',
  '/bugun — bugungi buyurtmalar soni va jami summasi',
  '/buyurtmalar — oxirgi 10 ta buyurtma',
  '/savdo — oxirgi 5 kundagi savdo',
  '/start — buyruqlar ro\'yxati',
].join('\n');

const GUEST_TEXT = 'Buyurtma berish uchun pastdagi «Menyu» tugmasini bosing';

// Webhook maxfiy belgisi: bot tokeni sha256 xeshining birinchi 32 belgisi.
function webhookSecret(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function som(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// ISO vaqtni Toshkent vaqtida "13.10.2026 14:05" ko'rinishiga keltiradi.
function tashkentTime(iso) {
  const d = new Date(new Date(iso).getTime() + TZ_OFFSET_MS);
  if (isNaN(d)) return '—';
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// Webhook javobi orqali xabar yuboriladi — alohida API so'rovi kerak emas.
function sendMessage(chatId, text) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ method: 'sendMessage', chat_id: chatId, text, parse_mode: 'HTML' }),
  };
}

const okEmpty = { statusCode: 200, body: '' };

async function supabaseSelect(query) {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !key) {
    const missing = [!url && 'SUPABASE_URL', !key && 'SUPABASE_SECRET_KEY'].filter(Boolean);
    throw new Error('Supabase sozlanmagan: ' + missing.join(', '));
  }
  const res = await fetch(`${url}/rest/v1/buyurtmalar?${query}`, {
    headers: {
      apikey: key,
      // Eski service_role kaliti (JWT) Authorization'da ham yuboriladi;
      // yangi sb_secret_... kalitlari uchun apikey yetarli.
      ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase xatosi ${res.status}: ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Toshkent vaqti bo'yicha bugungi kun boshi (UTC millisekundlarda).
function tashkentDayStart() {
  const now = new Date(Date.now() + TZ_OFFSET_MS);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - TZ_OFFSET_MS;
}

function tashkentDate(ms) {
  const d = new Date(ms + TZ_OFFSET_MS);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

// [fromMs, toMs) oralig'idagi buyurtmalar (yaratilgan, jami) — sahifalab o'qiladi.
async function ordersBetween(fromMs, toMs) {
  const from = encodeURIComponent(new Date(fromMs).toISOString());
  const to = encodeURIComponent(new Date(toMs).toISOString());
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = await supabaseSelect(
      `select=yaratilgan,jami&yaratilgan=gte.${from}&yaratilgan=lt.${to}&order=id.asc&limit=${PAGE}&offset=${offset}`
    );
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

function sumOf(rows) {
  return rows.reduce((s, r) => s + (Number(r.jami) || 0), 0);
}

async function todayText() {
  const startMs = tashkentDayStart();
  const rows = await ordersBetween(startMs, startMs + DAY_MS);
  return [
    `📅 <b>Bugun (${tashkentDate(startMs)})</b>`,
    '',
    `Buyurtmalar soni: <b>${rows.length} ta</b>`,
    `Jami summa: <b>${som(sumOf(rows))}</b>`,
  ].join('\n');
}

// Oxirgi 5 kun (bugun ham kiradi): har kun bo'yicha soni va summasi, oxirida jami.
async function salesText(days = 5) {
  const todayMs = tashkentDayStart();
  const fromMs = todayMs - (days - 1) * DAY_MS;
  const rows = await ordersBetween(fromMs, todayMs + DAY_MS);

  const lines = [];
  for (let i = 0; i < days; i++) {
    const dayMs = todayMs - i * DAY_MS;
    const dayRows = rows.filter((r) => {
      const t = new Date(r.yaratilgan).getTime();
      return t >= dayMs && t < dayMs + DAY_MS;
    });
    lines.push(`${tashkentDate(dayMs)}${i === 0 ? ' (bugun)' : ''} — ${dayRows.length} ta, ${som(sumOf(dayRows))}`);
  }
  return [
    `📊 <b>Oxirgi ${days} kundagi savdo</b>`,
    '',
    lines.join('\n'),
    '',
    `Jami: <b>${rows.length} ta buyurtma, ${som(sumOf(rows))}</b>`,
  ].join('\n');
}

async function lastOrdersText() {
  const rows = await supabaseSelect('select=yaratilgan,ism,telefon,jami&order=yaratilgan.desc&limit=10');
  if (!rows.length) return 'Hozircha buyurtmalar yo\'q.';
  const lines = rows.map((r, i) => [
    `<b>${i + 1}.</b> 🕒 ${tashkentTime(r.yaratilgan)}`,
    `👤 ${esc(r.ism)}   📞 ${esc(r.telefon)}`,
    `💰 ${som(Number(r.jami) || 0)}`,
  ].join('\n'));
  return '🧾 <b>Oxirgi 10 ta buyurtma</b>\n\n' + lines.join('\n\n');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: '' };
  }

  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const adminChat = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token) {
    console.error('Muhit o\'zgaruvchisi topilmadi: TELEGRAM_BOT_TOKEN');
    return { statusCode: 500, body: '' };
  }

  const headers = event.headers || {};
  const given = headers['x-telegram-bot-api-secret-token'] || headers['X-Telegram-Bot-Api-Secret-Token'] || '';
  if (!safeEqual(given, webhookSecret(token))) {
    return { statusCode: 401, body: '' };
  }

  let update;
  try {
    update = JSON.parse(event.body || '{}');
  } catch (e) {
    return okEmpty;
  }

  const msg = update.message;
  if (!msg || !msg.chat) return okEmpty;
  const chatId = msg.chat.id;

  // Boshqa chatlar buyurtma ma'lumotini ko'rmaydi.
  if (!adminChat || String(chatId) !== adminChat) {
    return sendMessage(chatId, GUEST_TEXT);
  }

  // Guruhda "/bugun@BotNomi" ko'rinishida kelishi mumkin.
  const text = typeof msg.text === 'string' ? msg.text.trim() : '';
  if (!text.startsWith('/')) return okEmpty; // guruhdagi oddiy xabarlarga javob bermaydi
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

  try {
    if (command === '/bugun') return sendMessage(chatId, await todayText());
    if (command === '/buyurtmalar') return sendMessage(chatId, await lastOrdersText());
    if (command === '/savdo') return sendMessage(chatId, await salesText());
  } catch (e) {
    console.error(e.message);
    // Sabab faqat buyurtmalar chatiga ko'rsatiladi; unda kalit yo'q (masalan, ustun topilmadi).
    return sendMessage(chatId, '⚠️ Ma\'lumotni olib bo\'lmadi. Birozdan keyin qayta urinib ko\'ring.\n\n' +
      `<i>Sabab: ${esc(e.message.slice(0, 300))}</i>`);
  }
  return sendMessage(chatId, COMMANDS_TEXT);
};
