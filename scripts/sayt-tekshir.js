// Jonli saytni tekshirish (GitHub Actions): node scripts/sayt-tekshir.js [--joylash]
//  - doim: bosh sahifa (/) va ruscha sahifa (/ru/) ochiladi va kutilgan matn bor;
//  - --joylash bilan (joylashdan keyin): /privacy va menyu ma'lumoti (/.netlify/functions/menyu) ham.
// Manzil: SAYT_URL (bo'lmasa https://burgersmash.uz). Har sahifa TEKSHIRUV_URINISH martagacha
// (bo'lmasa 3, 15 soniya oraliqda) uriniladi.
// Xato bo'lsa sababi chiqadi, GITHUB_OUTPUT ga «sabab» yoziladi va buyruq xato bilan tugaydi.
// «ixtiyoriy: true» belgilangan tekshiruv o'tmasa — faqat ogohlantirish (GITHUB_OUTPUT ga «ogohlantirish»),
// sayt qaytarilmaydi. Hozir bunday tekshiruv yo'q.

const fs = require('fs');

const BASE = (process.env.SAYT_URL || 'https://burgersmash.uz').replace(/\/+$/, '');
const URINISH = Math.max(1, Number(process.env.TEKSHIRUV_URINISH) || 3);
const ORALIQ_MS = 15000;
const TIMEOUT_MS = 20000;

const html = (...matnlar) => (text) => {
  const yoq = matnlar.filter((m) => !text.includes(m));
  return yoq.length ? `kutilgan matn yo'q: ${yoq.join(', ')}` : null;
};

const TEKSHIRUVLAR = [
  { yol: '/', tekshir: html('<html lang="uz"', 'id="menyu"', 'mc.yandex.ru/watch/') },
  { yol: '/ru/', tekshir: html('<html lang="ru"', 'id="menyu"', 'Меню') },
  { yol: '/privacy', joylash: true, tekshir: html('Maxfiylik siyosati') },
  {
    yol: '/.netlify/functions/menyu',
    joylash: true,
    tekshir: (text) => {
      try {
        const data = JSON.parse(text);
        // «items» — hostingdagi eski menyu.js javobi (sahifa ikkalasini ham o'qiydi).
        const taomlar = data && data.ok === true ? data.taomlar || data.items : null;
        if (Array.isArray(taomlar) && taomlar.length) return null;
        return `menyu bo'sh yoki ok emas: ${text.slice(0, 150)}`;
      } catch {
        return `menyu JSON emas: ${text.slice(0, 150)}`;
      }
    },
  },
];

async function birMarta({ yol, tekshir }) {
  const url = `${BASE}${yol}${yol.includes('?') ? '&' : '?'}tekshiruv=${Date.now()}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'burgersmash-tekshiruv/1.0 (GitHub Actions)', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return `ochilmadi (${e.cause && e.cause.code ? e.cause.code : e.name === 'TimeoutError' ? 'vaqt tugadi' : e.message})`;
  }
  const text = await res.text().catch(() => '');
  if (res.status !== 200) return `HTTP ${res.status}: ${text.replace(/\s+/g, ' ').slice(0, 150)}`;
  return tekshir(text);
}

async function main() {
  const joylash = process.argv.includes('--joylash');
  const xatolar = [];
  const ogohlantirishlar = [];
  for (const t of TEKSHIRUVLAR.filter((x) => joylash || !x.joylash)) {
    let xato;
    for (let i = 1; i <= URINISH; i++) {
      xato = await birMarta(t);
      if (!xato) break;
      console.log(`  ${t.yol}: ${xato} (${i}/${URINISH})`);
      if (i < URINISH) await new Promise((r) => setTimeout(r, ORALIQ_MS));
    }
    if (!xato) console.log(`✅ ${BASE}${t.yol}`);
    else if (t.ixtiyoriy) ogohlantirishlar.push(`${t.yol} — ${xato}`);
    else xatolar.push(`${t.yol} — ${xato}`);
  }

  const bir = (list) => list.join('; ').replace(/[\r\n]+/g, ' ');
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sabab=${bir(xatolar)}\nogohlantirish=${bir(ogohlantirishlar)}\n`);
  }
  for (const x of ogohlantirishlar) console.log(`::warning::${x}`);
  if (xatolar.length) {
    for (const x of xatolar) console.log(`::error::${x}`);
    process.exit(1);
  }
}

main();
