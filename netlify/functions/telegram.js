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

async function todayText() {
  const now = new Date(Date.now() + TZ_OFFSET_MS);
  const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - TZ_OFFSET_MS;
  const from = new Date(startMs).toISOString();
  const to = new Date(startMs + 24 * 60 * 60 * 1000).toISOString();

  let count = 0;
  let sum = 0;
  for (let offset = 0; ; offset += PAGE) {
    const rows = await supabaseSelect(
      `select=jami&yaratilgan=gte.${encodeURIComponent(from)}&yaratilgan=lt.${encodeURIComponent(to)}` +
      `&order=id.asc&limit=${PAGE}&offset=${offset}`
    );
    count += rows.length;
    sum += rows.reduce((s, r) => s + (Number(r.jami) || 0), 0);
    if (rows.length < PAGE) break;
  }

  const date = `${pad(now.getUTCDate())}.${pad(now.getUTCMonth() + 1)}.${now.getUTCFullYear()}`;
  return [
    `📅 <b>Bugun (${date})</b>`,
    '',
    `Buyurtmalar soni: <b>${count} ta</b>`,
    `Jami summa: <b>${som(sum)}</b>`,
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
  } catch (e) {
    console.error(e.message);
    return sendMessage(chatId, '⚠️ Ma\'lumotni olib bo\'lmadi. Birozdan keyin qayta urinib ko\'ring.');
  }
  return sendMessage(chatId, COMMANDS_TEXT);
};
