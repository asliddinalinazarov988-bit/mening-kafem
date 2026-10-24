// Admin sahifa: hostingda https://DOMEN/admin (yoki /.netlify/functions/admin).
//  - faqat hostingda (PGDATABASE bor) ishlaydi, aks holda 404;
//  - kirish ADMIN_PAROL muhit o'zgaruvchisi bilan (kamida 10 belgi), sessiya — imzolangan cookie (30 kun);
//  - menyu: narx, «Tugadi / Bor», tahrirlash, o'chirish, yangi taom;
//  - stol QR-kodlari: ?qr=N — chop etishga tayyor sahifa (A4 ga 6 tadan).
// Barcha o'zgartirishlar POST va CSRF tokeni bilan. Parol va kalitlar sahifada ko'rsatilmaydi.

const crypto = require('crypto');
const db = require('../lib/db');

const COOKIE = 'admin_sessiya';
const SESSION_DAYS = 30;
const MIN_PASSWORD = 10;
const FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 daqiqa
const FAIL_MAX = 5;                    // shu oraliqda ko'pi bilan 5 ta noto'g'ri parol
const MAX_TABLES = 99;
const LIMITS = { nomi: 60, tavsif: 200, narx_matn: 30, belgi: 15, narx: 10000000 };

const TOIFA_NOMI = { burger: 'Burgerlar', lavash: 'Lavash', extra: 'Boshqa taomlar', drink: 'Ichimliklar' };
const BELGILAR = ['Xit', 'Firma'];

const MESSAGES = {
  qoshildi: "✅ Taom qo'shildi",
  saqlandi: '✅ Saqlandi',
  ochirildi: "✅ Taom o'chirildi",
  topilmadi: '❌ Taom topilmadi',
};

// --- Yordamchilar ---

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clean(v) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}

function som(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
}

function password() {
  return process.env.ADMIN_PAROL || '';
}

// Kirish nega yopiqligi (bo'lmasa null).
function closedReason() {
  const p = password();
  if (!p) return "ADMIN_PAROL muhit o'zgaruvchisi o'rnatilmagan.";
  if ([...p].length < MIN_PASSWORD) return `ADMIN_PAROL ${MIN_PASSWORD} belgidan qisqa — uzunroq parol qo'ying.`;
  return null;
}

function hmac(data) {
  return crypto.createHmac('sha256', password()).update(data).digest('base64url');
}

// Uzunligi har xil bo'lsa ham vaqt bo'yicha xavfsiz solishtirish.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function newSession() {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const nonce = crypto.randomBytes(12).toString('base64url');
  const data = `${exp}.${nonce}`;
  return `${data}.${hmac('sessiya:' + data)}`;
}

function getCookie(headers, name) {
  for (const part of String(headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

// Cookie to'g'ri va muddati o'tmagan bo'lsa uning qiymati, aks holda null.
function validSession(headers) {
  const v = getCookie(headers, COOKIE);
  const m = v.match(/^(\d{1,15})\.([\w-]{1,40})\.([\w-]{43})$/);
  if (!m) return null;
  if (!safeEqual(m[3], hmac(`sessiya:${m[1]}.${m[2]}`))) return null;
  if (Number(m[1]) < Date.now()) return null;
  return v;
}

function csrfToken(session) {
  return hmac('csrf:' + session);
}

function sessionCookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

// Noto'g'ri parollar (xotirada, IP bo'yicha).
const fails = new Map();
function clientIp(headers) {
  // Proksi o'zi qo'shgan oxirgi manzil — mijoz yozgan qiymatlarga ishonilmaydi.
  const xff = String(headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return headers['x-nf-client-connection-ip'] || xff[xff.length - 1] || 'noma\'lum';
}
function recentFails(ip) {
  const now = Date.now();
  const list = (fails.get(ip) || []).filter((t) => now - t < FAIL_WINDOW_MS);
  if (list.length) fails.set(ip, list);
  else fails.delete(ip);
  return list;
}
function addFail(ip) {
  const list = recentFails(ip);
  list.push(Date.now());
  fails.set(ip, list);
  if (fails.size > 10000) fails.delete(fails.keys().next().value);
}

function basePath(event) {
  return event.path === '/admin' || event.path === '/admin/' ? '/admin' : '/.netlify/functions/admin';
}

function siteOrigin(event) {
  try {
    return new URL(event.rawUrl).origin;
  } catch (e) {
    return 'https://' + (event.headers.host || 'localhost');
  }
}

function parseForm(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
  return new URLSearchParams(raw);
}

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

function html(statusCode, title, body, opts) {
  const nonce = crypto.randomBytes(16).toString('base64');
  const headers = Object.assign(
    {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    },
    SECURITY_HEADERS
  );
  const res = {
    statusCode,
    headers,
    body: `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>${(opts && opts.css) || CSS}</style>
</head>
<body>${body}
<script nonce="${nonce}">
  document.querySelectorAll('form[data-tasdiq]').forEach(function(f){
    f.addEventListener('submit', function(e){ if (!confirm(f.dataset.tasdiq)) e.preventDefault(); });
  });
  document.querySelectorAll('[data-chop]').forEach(function(b){
    b.addEventListener('click', function(){ window.print(); });
  });
</script>
</body>
</html>`,
  };
  return res;
}

function redirect(location, cookie) {
  const headers = Object.assign({ Location: location }, SECURITY_HEADERS);
  if (cookie) headers['Set-Cookie'] = cookie;
  return { statusCode: 303, headers, body: '' };
}

function notFound() {
  return { statusCode: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Not Found' };
}

const CSS = `
  *{box-sizing:border-box}
  body{margin:0;background:#0b0b0b;color:#f5f5f5;font-family:Montserrat,system-ui,sans-serif;font-size:15px;padding:20px 14px 60px}
  main{max-width:640px;margin:0 auto}
  h1{color:#d4af37;font-size:24px;margin:0}
  h2{color:#d4af37;font-size:19px;margin:30px 0 12px;border-bottom:1px solid #2a2a2a;padding-bottom:8px}
  .top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}
  .box{background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:14px;margin-bottom:10px}
  .box.bad{border-color:#e05a5a}
  .box.ok{border-color:#3d9b5c}
  .item.off{opacity:.6}
  .item-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
  .item-head b{font-size:16px}
  .item-head small,.muted{color:#aaa;font-size:13px}
  .tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;padding:2px 8px;border-radius:20px;background:#d4af37;color:#0b0b0b;margin-left:6px;vertical-align:2px}
  .tag.off{background:#555;color:#eee}
  .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
  .row form{display:flex;gap:8px;align-items:center;margin:0}
  label{display:block;font-size:13px;color:#aaa;margin:10px 0 4px}
  input,select,textarea{width:100%;font:inherit;color:#f5f5f5;background:#0b0b0b;border:1px solid #333;border-radius:10px;padding:10px 12px}
  .row input{width:130px}
  button{font:inherit;font-weight:600;border-radius:10px;padding:10px 14px;border:1px solid #d4af37;background:transparent;color:#d4af37;cursor:pointer}
  button.gold{background:#d4af37;color:#0b0b0b}
  button.red{border-color:#e05a5a;color:#e05a5a}
  button.wide{width:100%;margin-top:14px}
  details{margin-top:10px}
  summary{cursor:pointer;color:#d4af37;font-size:14px}
`;

// --- Sahifalar ---

function loginPage(message, status) {
  const reason = closedReason();
  const body = reason
    ? `<div class="box bad"><b>Kirish yopiq</b><div class="muted">${esc(reason)}</div></div>`
    : `${message ? `<div class="box bad">${esc(message)}</div>` : ''}
<form method="post" class="box">
  <input type="hidden" name="amal" value="kirish">
  <label for="parol">Parol</label>
  <input id="parol" name="parol" type="password" autocomplete="current-password" required autofocus>
  <button class="gold wide" type="submit">Kirish</button>
</form>`;
  return html(status || 200, 'Admin — kirish', `<main><div class="top"><h1>Admin</h1></div>${body}</main>`);
}

function toifaOptions(selected) {
  return db.TOIFALAR.map((t) => `<option value="${t}"${t === selected ? ' selected' : ''}>${esc(TOIFA_NOMI[t])}</option>`).join('');
}

function itemCard(t, csrf) {
  const hidden = `<input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="id" value="${t.id}">`;
  return `<div class="box item${t.mavjud ? '' : ' off'}">
  <div class="item-head">
    <div><b>${esc(t.nomi)}</b>${t.belgi ? `<span class="tag">${esc(t.belgi)}</span>` : ''}${t.mavjud ? '' : '<span class="tag off">TUGADI</span>'}
      <div class="muted">${esc(t.tavsif)}</div></div>
    <small>${esc(t.narx_matn || som(t.narx))}</small>
  </div>
  <div class="row">
    <form method="post">${hidden}<input type="hidden" name="amal" value="narx">
      <input name="narx" type="number" inputmode="numeric" min="1" max="${LIMITS.narx}" step="1" value="${t.narx}" aria-label="Narx (so'm)" required>
      <button type="submit">Saqlash</button></form>
    <form method="post">${hidden}<input type="hidden" name="amal" value="mavjud"><input type="hidden" name="mavjud" value="${t.mavjud ? '0' : '1'}">
      <button type="submit"${t.mavjud ? ' class="red"' : ''}>${t.mavjud ? 'Tugadi' : 'Bor'}</button></form>
  </div>
  <details><summary>Tahrirlash</summary>
    <form method="post">${hidden}<input type="hidden" name="amal" value="tahrir">
      <label>Nomi</label><input name="nomi" maxlength="${LIMITS.nomi}" value="${esc(t.nomi)}" required>
      <label>Tavsif</label><input name="tavsif" maxlength="${LIMITS.tavsif}" value="${esc(t.tavsif)}">
      <label>Toifa</label><select name="toifa">${toifaOptions(t.toifa)}</select>
      <label>Narx matni (ixtiyoriy, masalan «42–46 ming»)</label><input name="narx_matn" maxlength="${LIMITS.narx_matn}" value="${esc(t.narx_matn || '')}">
      <label>Belgi (ixtiyoriy)</label><input name="belgi" list="belgilar" maxlength="${LIMITS.belgi}" value="${esc(t.belgi || '')}">
      <button class="gold wide" type="submit">Saqlash</button>
    </form>
    <form method="post" data-tasdiq="${esc(`«${t.nomi}» o'chirilsinmi?`)}">${hidden}<input type="hidden" name="amal" value="ochirish">
      <button class="red wide" type="submit">O'chirish</button>
    </form>
  </details>
</div>`;
}

async function mainPage(event, session, flash, flashBad) {
  const csrf = csrfToken(session);
  let menu;
  try {
    menu = await db.menuList(true);
  } catch (e) {
    console.error('[admin]', e.message);
    return html(500, 'Admin', `<main><h1>Admin</h1><div class="box bad"><b>Baza javob bermadi</b><div class="muted">${esc(e.message.slice(0, 300))}</div></div></main>`);
  }

  const sections = db.TOIFALAR.map((toifa) => {
    const list = menu.filter((t) => t.toifa === toifa);
    return `<h2>${esc(TOIFA_NOMI[toifa])}</h2>${list.length ? list.map((t) => itemCard(t, csrf)).join('') : '<p class="muted">Taom yo\'q</p>'}`;
  }).join('');

  const body = `<main>
<div class="top"><h1>Admin</h1>
  <form method="post"><input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="amal" value="chiqish"><button type="submit">Chiqish</button></form>
</div>
${flash ? `<div class="box ${flashBad ? 'bad' : 'ok'}">${esc(flash)}</div>` : ''}
<datalist id="belgilar">${BELGILAR.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
${sections}
<h2>Yangi taom</h2>
<form method="post" class="box">
  <input type="hidden" name="csrf" value="${esc(csrf)}"><input type="hidden" name="amal" value="yangi">
  <label for="yNomi">Nomi</label><input id="yNomi" name="nomi" maxlength="${LIMITS.nomi}" required>
  <label for="yTavsif">Tavsif</label><input id="yTavsif" name="tavsif" maxlength="${LIMITS.tavsif}">
  <label for="yToifa">Toifa</label><select id="yToifa" name="toifa">${toifaOptions('burger')}</select>
  <label for="yNarx">Narx (so'm)</label><input id="yNarx" name="narx" type="number" inputmode="numeric" min="1" max="${LIMITS.narx}" step="1" required>
  <button class="gold wide" type="submit">Qo'shish</button>
</form>
<h2>Stol QR-kodlari</h2>
<form method="get" target="_blank" class="box">
  <label for="qr">Stollar soni (1–${MAX_TABLES})</label>
  <input id="qr" name="qr" type="number" inputmode="numeric" min="1" max="${MAX_TABLES}" step="1" value="20" required>
  <button class="gold wide" type="submit">Chop etish sahifasini ochish</button>
  <p class="muted">Har bir QR <b>${esc(siteOrigin(event))}/?stol=N</b> manzilini ochadi.</p>
</form>
</main>`;
  return html(flashBad ? 400 : 200, 'Admin', body);
}

const QR_CSS = `
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:#000;font-family:Montserrat,system-ui,sans-serif}
  .bar{padding:14px;text-align:center}
  .bar button{font:inherit;font-weight:700;padding:12px 24px;border-radius:10px;border:0;background:#d4af37;color:#000;cursor:pointer}
  .sheet{display:grid;grid-template-columns:1fr 1fr;gap:8mm;padding:10mm;max-width:210mm;margin:0 auto}
  .card{border:1.5px dashed #999;border-radius:6mm;height:85mm;padding:5mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;break-inside:avoid;page-break-inside:avoid}
  .card b{font-size:40px;line-height:1;letter-spacing:1px}
  .card svg{width:52mm;height:52mm;margin:3mm 0}
  .card small{font-size:12px;color:#444}
  @page{size:A4;margin:10mm}
  @media print{.bar{display:none}.sheet{padding:0}}
  @media (max-width:520px){.sheet{grid-template-columns:1fr}}
`;

async function qrPage(event, count) {
  const QRCode = require('qrcode');
  const origin = siteOrigin(event);
  const cards = [];
  for (let n = 1; n <= count; n++) {
    const url = `${origin}/?stol=${n}`;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    cards.push(`<div class="card"><b>Stol ${n}</b>${svg}<small>Menyu va buyurtma uchun skanerlang</small></div>`);
  }
  const body = `<div class="bar"><button type="button" data-chop>Chop etish</button></div><div class="sheet">${cards.join('')}</div>`;
  return html(200, 'Stol QR-kodlari', body, { css: QR_CSS });
}

// --- Taom ma'lumotlarini tekshirish ---

function parseId(v) {
  return /^\d{1,15}$/.test(v || '') ? Number(v) : null;
}

function parseNarx(v) {
  const s = String(v || '').replace(/\s/g, '');
  if (!/^\d{1,9}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= LIMITS.narx ? n : null;
}

// Xato bo'lsa { error }, aks holda tozalangan qiymatlar.
function parseItem(f, full) {
  const t = {
    nomi: clean(f.get('nomi')),
    tavsif: clean(f.get('tavsif')),
    toifa: f.get('toifa') || '',
  };
  if (t.nomi.length < 1 || t.nomi.length > LIMITS.nomi) return { error: `Nomi 1 dan ${LIMITS.nomi} belgigacha bo'lsin` };
  if (t.tavsif.length > LIMITS.tavsif) return { error: `Tavsif ${LIMITS.tavsif} belgidan oshmasin` };
  if (!db.TOIFALAR.includes(t.toifa)) return { error: "Toifa noto'g'ri" };
  if (full) {
    t.narx_matn = clean(f.get('narx_matn')) || null;
    t.belgi = clean(f.get('belgi')) || null;
    if (t.narx_matn && t.narx_matn.length > LIMITS.narx_matn) return { error: `Narx matni ${LIMITS.narx_matn} belgidan oshmasin` };
    if (t.belgi && t.belgi.length > LIMITS.belgi) return { error: `Belgi ${LIMITS.belgi} belgidan oshmasin` };
  } else {
    t.narx = parseNarx(f.get('narx'));
    if (!t.narx) return { error: `Narx 1 dan ${LIMITS.narx} so'mgacha butun son bo'lsin` };
  }
  return t;
}

async function handleAction(event, session, f) {
  const base = basePath(event);
  const done = (m) => redirect(`${base}?m=${m}`);
  const amal = f.get('amal');

  if (amal === 'chiqish') return redirect(base, sessionCookie('', 0));

  try {
    if (amal === 'yangi') {
      const t = parseItem(f, false);
      if (t.error) return mainPage(event, session, '❌ ' + t.error, true);
      await db.menuAdd(t);
      return done('qoshildi');
    }

    const id = parseId(f.get('id'));
    if (!id) return done('topilmadi');
    let found;
    if (amal === 'narx') {
      const narx = parseNarx(f.get('narx'));
      if (!narx) return mainPage(event, session, `❌ Narx 1 dan ${LIMITS.narx} so'mgacha butun son bo'lsin`, true);
      found = await db.menuSetPrice(id, narx);
    } else if (amal === 'mavjud') {
      found = await db.menuSetAvailable(id, f.get('mavjud') === '1');
    } else if (amal === 'tahrir') {
      const t = parseItem(f, true);
      if (t.error) return mainPage(event, session, '❌ ' + t.error, true);
      found = await db.menuEdit(id, t);
    } else if (amal === 'ochirish') {
      found = await db.menuDelete(id);
      return done(found ? 'ochirildi' : 'topilmadi');
    } else {
      return mainPage(event, session, "❌ Noma'lum amal", true);
    }
    return done(found ? 'saqlandi' : 'topilmadi');
  } catch (e) {
    if (e.code === '23505') return mainPage(event, session, '❌ Bu nomli taom allaqachon bor', true);
    console.error('[admin]', e.message);
    return mainPage(event, session, '❌ Saqlanmadi: ' + e.message.slice(0, 200), true);
  }
}

exports.handler = async (event) => {
  if (!db.usingPg) return notFound();
  event.headers = event.headers || {};
  const method = event.httpMethod;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
    return { statusCode: 405, headers: { Allow: 'GET, POST', 'Content-Type': 'text/plain; charset=utf-8' }, body: 'Method Not Allowed' };
  }
  const q = event.queryStringParameters || {};

  if (closedReason()) return loginPage('', 503);

  const session = validSession(event.headers);

  if (method === 'POST') {
    if ((event.body || '').length > 10000) return loginPage("So'rov juda katta", 413);
    const f = parseForm(event);

    if (f.get('amal') === 'kirish') {
      const ip = clientIp(event.headers);
      if (recentFails(ip).length >= FAIL_MAX) return loginPage("Noto'g'ri parol ko'p kiritildi. Biroz kuting (15 daqiqa).", 429);
      if (!safeEqual(f.get('parol') || '', password())) {
        addFail(ip);
        return loginPage("Parol noto'g'ri", 401);
      }
      fails.delete(ip);
      return redirect(basePath(event), sessionCookie(newSession(), SESSION_DAYS * 24 * 60 * 60));
    }

    if (!session) return loginPage('Sessiya tugagan, qayta kiring', 401);
    if (!safeEqual(f.get('csrf') || '', csrfToken(session))) {
      return mainPage(event, session, "❌ Xavfsizlik tokeni noto'g'ri. Sahifani yangilab, qayta urinib ko'ring.", true);
    }
    return handleAction(event, session, f);
  }

  if (!session) return loginPage('');

  if (q.qr !== undefined) {
    const n = /^\d{1,2}$/.test(q.qr) ? Number(q.qr) : 0;
    if (n < 1 || n > MAX_TABLES) return mainPage(event, session, `❌ Stollar soni 1 dan ${MAX_TABLES} gacha bo'lsin`, true);
    return qrPage(event, n);
  }

  const m = MESSAGES[q.m];
  return mainPage(event, session, m || '', m === MESSAGES.topilmadi);
};
