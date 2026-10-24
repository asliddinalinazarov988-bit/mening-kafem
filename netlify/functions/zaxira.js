// Kunlik zaxira (cron: curl -s https://DOMEN/.netlify/functions/zaxira > /dev/null).
//  - faqat hostingda (PGDATABASE bor) ishlaydi;
//  - pg_dump bilan nusxa olib, gzip qiladi va ~/zaxira/buyurtmalar-YYYY-MM-DD.sql.gz ga saqlaydi
//    (Toshkent sanasi); bugungi fayl bo'lsa qayta qilmaydi — shuning uchun maxfiy kalit kerak emas;
//  - 14 kundan eski zaxiralarni o'chiradi;
//  - faylni Telegram orqali faqat TELEGRAM_CHAT_ID ga yuboradi.
// Ulanish PG* muhit o'zgaruvchilaridan olinadi, parol buyruq qatoriga yozilmaydi.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const db = require('../lib/db');

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Toshkent: UTC+5, yozgi vaqt yo'q
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_DAYS = 14;
const DIR = path.join(os.homedir(), 'zaxira');
const FILE_RE = /^buyurtmalar-(\d{4})-(\d{2})-(\d{2})\.sql\.gz$/;

let running = false;

function text(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, body };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// pg_dump natijasini Buffer sifatida qaytaradi.
function pgDump() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PGHOST: process.env.PGHOST || 'localhost' };
    const child = spawn('pg_dump', ['--no-owner', '--no-privileges', '--clean', '--if-exists'], { env });
    const out = [];
    const err = [];
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', (e) => reject(new Error('pg_dump ishga tushmadi: ' + e.message)));
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`pg_dump xatosi (${code}): ${Buffer.concat(err).toString('utf8').trim().slice(0, 300)}`));
    });
  });
}

// 14 kundan eski zaxira fayllarini o'chiradi; o'chirilganlar sonini qaytaradi.
function removeOld(todayMs) {
  const limit = todayMs - KEEP_DAYS * DAY_MS;
  let removed = 0;
  for (const name of fs.readdirSync(DIR)) {
    const m = name.match(FILE_RE);
    if (!m) continue;
    if (Date.UTC(+m[1], +m[2] - 1, +m[3]) < limit) {
      try {
        fs.unlinkSync(path.join(DIR, name));
        removed++;
      } catch (e) {
        console.error('[zaxira] o\'chirilmadi:', name, e.message);
      }
    }
  }
  return removed;
}

async function sendDocument(token, chatId, fileName, data, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('document', new Blob([data], { type: 'application/gzip' }), fileName);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new Error(`Telegram xatosi ${res.status}: ${out.description || 'noma\'lum'}`);
}

exports.handler = async () => {
  if (!db.usingPg) {
    return text(400, 'Bu funksiya faqat hostingda ishlaydi');
  }
  if (running) return text(409, 'Zaxira hozir olinmoqda');
  running = true;

  try {
    // Toshkent sanasi; Date.UTC bilan hisoblanadi, shuning uchun server vaqt mintaqasi ahamiyatsiz.
    const now = new Date(Date.now() + TZ_OFFSET_MS);
    const y = now.getUTCFullYear();
    const mo = pad(now.getUTCMonth() + 1);
    const d = pad(now.getUTCDate());
    const todayMs = Date.UTC(y, now.getUTCMonth(), now.getUTCDate());
    const fileName = `buyurtmalar-${y}-${mo}-${d}.sql.gz`;
    const file = path.join(DIR, fileName);

    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    if (fs.existsSync(file)) {
      return text(200, `Bugun zaxira olingan: ${fileName}`);
    }

    const count = await db.countOrders();
    const gz = zlib.gzipSync(await pgDump());
    // Avval vaqtinchalik faylga yoziladi — yarim yozilgan fayl «bugungi zaxira» bo'lib qolmasin.
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, gz, { mode: 0o600 });
    fs.renameSync(tmp, file);

    const removed = removeOld(todayMs);
    const lines = [`Zaxira olindi: ${fileName} (${count} ta buyurtma, ${gz.length} bayt)`];
    if (removed) lines.push(`Eski zaxiralar o'chirildi: ${removed} ta`);

    const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
    if (!token || !chatId) {
      const missing = [!token && 'TELEGRAM_BOT_TOKEN', !chatId && 'TELEGRAM_CHAT_ID'].filter(Boolean);
      lines.push('Telegram\'ga yuborilmadi: ' + missing.join(', ') + ' topilmadi');
      return text(200, lines.join('\n'));
    }
    try {
      await sendDocument(token, chatId, fileName, gz, `🗄 Kunlik zaxira: ${d}.${mo}, ${count} ta buyurtma`);
      lines.push('Telegram\'ga yuborildi');
    } catch (e) {
      console.error('[zaxira]', e.message);
      lines.push('Telegram\'ga yuborilmadi: ' + e.message.slice(0, 200));
    }
    return text(200, lines.join('\n'));
  } catch (e) {
    console.error('[zaxira]', e.message);
    return text(500, 'Zaxira olinmadi: ' + e.message.slice(0, 300));
  } finally {
    running = false;
  }
};
