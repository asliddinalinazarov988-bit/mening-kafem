// Ruscha tarjimani tekshirish: node scripts/ru.js --check
// index.html va privacy.html dagi har bir o'zbekcha matnning tarjimasi i18n/ru.js da bo'lishi kerak.
// Tarjimasi yo'q matnlar ro'yxati chiqadi va buyruq xato bilan tugaydi (npm test ham shuni ishlatadi).
// Fayl yozilmaydi; Netlify uchun ru/ papkasini yasash — node netlify/lib/i18n.js.

const fs = require('fs');
const path = require('path');
const { translateHtml } = require('../netlify/lib/i18n');

const ROOT = path.join(__dirname, '..');
const PAGES = { index: 'index.html', privacy: 'privacy.html' };

if (!process.argv.includes('--check')) {
  console.log('Foydalanish: node scripts/ru.js --check');
  process.exit(2);
}

let missing = 0;
for (const [page, name] of Object.entries(PAGES)) {
  const list = [];
  translateHtml(fs.readFileSync(path.join(ROOT, name), 'utf8'), page, list);
  for (const s of list) console.error(`⚠️ ${name}: tarjimasi yo'q: ${s}`);
  missing += list.length;
}
if (missing) {
  console.error(`\n${missing} ta matnning tarjimasi yo'q — i18n/ru.js dagi «matn» ga qo'shing.`);
  process.exit(1);
}
console.log('✅ Ruscha tarjima to\'liq (index.html, privacy.html)');
