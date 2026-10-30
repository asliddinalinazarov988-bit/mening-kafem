// GitHub Actions'dan Telegram'ga qisqa xabar: node scripts/telegram.js "matn"
// Kalitlar faqat muhit o'zgaruvchilaridan (GitHub Secrets): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
// Kalit yo'q yoki Telegram javob bermasa — faqat ogohlantirish, workflow yiqilmaydi.

async function main() {
  // Bo'sh qatorlar (masalan, bo'sh o'zgaruvchi o'rni) olib tashlanadi.
  const text = process.argv.slice(2).join(' ').replace(/\n\s*\n/g, '\n').trim();
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!text) {
    console.log('::warning::Telegram: xabar matni bo\'sh');
    return;
  }
  if (!token || !chatId) {
    console.log('::warning::TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID GitHub Secrets\'da yo\'q — Telegram xabari yuborilmadi');
    console.log(text);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(20000),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) {
      console.log(`::warning::Telegram xatosi ${res.status}: ${out.description || 'noma\'lum'}`);
      return;
    }
    console.log('Telegram\'ga yuborildi:\n' + text);
  } catch (e) {
    console.log(`::warning::Telegram bilan aloqa yo'q: ${e.message}`);
  }
}

main();
