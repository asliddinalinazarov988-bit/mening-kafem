// Saytning ruscha versiyasi. Tarjimalar bitta joyda — i18n/ru.js (lug'at).
//  - render('index' | 'privacy'): index.html / privacy.html dan ruscha sahifa yasaydi —
//    matnlar, alt/aria-label/placeholder/title/meta content qiymatlari lug'at bo'yicha almashtiriladi,
//    <script id="matnlar"> (JavaScript matnlari) ruschasiga almashtiriladi, sahifa uchun aniq almashtirishlar bajariladi.
//  - hostingda server.js /ru va /ru/privacy ni shu modul orqali beradi (fayl o'zgarsa kesh yangilanadi);
//  - Netlify'da build paytida `node netlify/lib/i18n.js` ru/index.html va ru/privacy.html ni yozadi.
// Shuningdek: taom nomi/tavsifi tarjimasi (bazani bir marta to'ldirish uchun) va order.js xabarlari.

const fs = require('fs');
const path = require('path');
const RU = require('../../i18n/ru');

const ROOT = path.join(__dirname, '..', '..');
const PAGES = { index: 'index.html', privacy: 'privacy.html' };
const ATTRS = new Set(['content', 'alt', 'aria-label', 'placeholder', 'title']);

function norm(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

function escText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return escText(s).replace(/"/g, '&quot;');
}

const KEEP = new Set(RU.ozgarmas.map(norm));
const MATN = new Map(Object.entries(RU.matn).map(([k, v]) => [norm(k), v]));

// «39 000 so'm», «42–46 ming so'm» kabi narxlar avtomatik tarjima qilinadi.
const PRICE = /^[\d\s.,–-]+(ming\s+)?so['ʻ’‘`]m$/;

function hasWords(s) {
  // Ruscha harf bo'lsa — allaqachon tarjima qilingan (masalan, «sahifa» almashtirishidan keyin).
  return /[A-Za-z]{2,}/.test(s) && !/[А-яЁё]/.test(s) && !KEEP.has(norm(s));
}

// Matn bo'lagi: lug'atda bo'lsa ruschasi (atrofidagi bo'sh joylar saqlanadi).
function translateText(s, missing) {
  const key = norm(s);
  if (!key) return s;
  if (MATN.has(key)) {
    const lead = s.match(/^\s*/)[0];
    const trail = s.slice(lead.length).match(/\s*$/)[0];
    return lead + escText(MATN.get(key)) + trail;
  }
  if (PRICE.test(key)) return s.replace(key, narxMatnRu(key));
  if (hasWords(key)) missing.push(key);
  return s;
}

function translateTag(tag, missing) {
  return tag.replace(/(\s)([\w:-]+)="([^"]*)"/g, (all, sp, name, value) => {
    if (!ATTRS.has(name.toLowerCase())) return all;
    const key = norm(value);
    if (MATN.has(key)) return `${sp}${name}="${escAttr(MATN.get(key))}"`;
    if (name !== 'content' && hasWords(key)) missing.push(key);
    return all;
  });
}

// O'zbekcha HTML -> ruscha HTML. missing — tarjimasi topilmagan matnlar (tekshirish uchun).
function translateHtml(html, page, missing) {
  for (const [from, to] of RU.sahifa[page] || []) {
    const parts = html.split(from);
    if (parts.length !== 2) {
      missing.push(`[${page}] almashtirish ${parts.length - 1} marta topildi: ${from.slice(0, 80)}`);
      continue;
    }
    html = parts.join(to);
  }

  const re = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>|<\/?[a-zA-Z][^>]*>/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    out += translateText(html.slice(last, m.index), missing);
    if (m[1] === 'script' && /\bid="matnlar"/.test(m[2])) {
      const json = JSON.stringify(RU.js, null, 2).replace(/</g, '\\u003c');
      out += `<script${m[2]}>\n${json}\n</script>`;
    } else if (m[0].startsWith('<!') || m[1]) {
      out += m[0];
    } else {
      out += translateTag(m[0], missing);
    }
    last = re.lastIndex;
  }
  return out + translateText(html.slice(last), missing);
}

const cache = new Map(); // page -> { mtime, html }

// Ruscha sahifa (hostingda). Fayl o'zgarmaguncha xotiradan beriladi.
function render(page) {
  const file = path.join(ROOT, PAGES[page]);
  const mtime = fs.statSync(file).mtimeMs;
  const hit = cache.get(page);
  if (hit && hit.mtime === mtime) return hit.html;
  const missing = [];
  const html = translateHtml(fs.readFileSync(file, 'utf8'), page, missing);
  if (missing.length) console.error(`[ru] ${PAGES[page]}: tarjimasi yo'q:`, missing.join(' | '));
  cache.set(page, { mtime, html });
  return html;
}

// --- Menyu va server xabarlari ---

// Taom nomi yoki tavsifining ruschasi (lug'atda bo'lmasa ''; «Coca-Cola» kabi o'zgarmas nomlar o'zicha).
function taomRu(s) {
  const key = norm(s || '');
  if (!key) return '';
  return MATN.get(key) || (KEEP.has(key) ? key : '');
}

// Narx matni: «so'm» -> «сум», «ming» -> «тыс.».
function narxMatnRu(s) {
  if (!s) return '';
  return String(s)
    .replace(/so['ʻ’‘`]m/gi, 'сум')
    .replace(/(^|[^A-Za-z'ʻ’])ming(?![A-Za-z])/gi, '$1тыс.');
}

// order.js xabari: til === 'ru' bo'lsa ruschasi, {nomi} kabi o'rinlar to'ldiriladi.
function serverMatn(til, msg, vars) {
  const s = (til === 'ru' && RU.server[msg]) || msg;
  return s.replace(/\{(\w+)\}/g, (all, k) => (vars && vars[k] != null ? vars[k] : all));
}

module.exports = { render, translateHtml, taomRu, narxMatnRu, serverMatn };

// Netlify build: ru/index.html va ru/privacy.html ni yozadi, tarjimasi yo'q matnlarni ko'rsatadi.
if (require.main === module) {
  const outDir = path.join(ROOT, 'ru');
  fs.mkdirSync(outDir, { recursive: true });
  let warnings = 0;
  for (const [page, name] of Object.entries(PAGES)) {
    const missing = [];
    const html = translateHtml(fs.readFileSync(path.join(ROOT, name), 'utf8'), page, missing);
    fs.writeFileSync(path.join(outDir, name), html);
    console.log(`ru/${name} yozildi`);
    for (const s of missing) console.warn(`  ⚠️ tarjimasi yo'q: ${s}`);
    warnings += missing.length;
  }
  if (warnings && process.argv.includes('--qattiq')) process.exit(1);
}
