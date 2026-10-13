// Botni sozlaydi: brauzerda /.netlify/functions/telegram-setup ni oching.
//  - webhook'ni shu saytdagi /.netlify/functions/telegram ga o'rnatadi (maxfiy belgi bilan);
//  - buyruqlar ro'yxatini sozlaydi (to'liq ro'yxat faqat TELEGRAM_CHAT_ID dagi chatda);
//  - «Menyu» tugmasini shu saytni Mini App qilib ochadigan qiladi.
// Token sahifada ko'rsatilmaydi.

const crypto = require('crypto');

// telegram.js dagi bilan bir xil: bot tokeni sha256 xeshining birinchi 32 belgisi.
function webhookSecret(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(statusCode, rows, footer) {
  const list = rows.map((r) =>
    `<li class="${r.ok ? 'ok' : 'bad'}"><span>${r.ok ? '✅' : '❌'}</span><div><b>${esc(r.title)}</b><small>${esc(r.detail)}</small></div></li>`
  ).join('');
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    body: `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Botni sozlash</title>
<style>
  body{margin:0;background:#0b0b0b;color:#f5f5f5;font-family:Montserrat,system-ui,sans-serif;padding:32px 16px}
  main{max-width:560px;margin:0 auto}
  h1{color:#d4af37;font-size:24px;margin:0 0 20px}
  ul{list-style:none;padding:0;margin:0 0 20px}
  li{display:flex;gap:12px;align-items:flex-start;background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:14px;margin-bottom:10px}
  li.bad{border-color:#e05a5a}
  li b{display:block;margin-bottom:4px}
  small{color:#aaa;word-break:break-word}
  p{color:#aaa;font-size:14px;line-height:1.5}
</style>
</head>
<body><main><h1>Telegram botini sozlash</h1><ul>${list}</ul><p>${esc(footer)}</p></main></body>
</html>`,
  };
}

async function tg(token, method, params) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    const out = await res.json().catch(() => ({}));
    return { ok: !!out.ok, result: out.result, error: out.description || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: 'Telegram bilan aloqa yo\'q' };
  }
}

exports.handler = async (event) => {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const adminChat = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token) {
    return page(500, [{ ok: false, title: 'TELEGRAM_BOT_TOKEN topilmadi', detail: 'Netlify → Environment variables ga qo\'shib, saytni qayta deploy qiling.' }], '');
  }

  // So'rov kelgan sayt manzili (masalan, https://mening-kafem.netlify.app)
  const headers = event.headers || {};
  const host = headers['x-forwarded-host'] || headers.host;
  const proto = (headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const origin = event.rawUrl ? new URL(event.rawUrl).origin : `${proto}://${host}`;
  const webhookUrl = `${origin}/.netlify/functions/telegram`;
  const siteUrl = `${origin}/`;

  const rows = [];

  const me = await tg(token, 'getMe');
  rows.push(me.ok
    ? { ok: true, title: 'Bot topildi', detail: `@${me.result.username}` }
    : { ok: false, title: 'Bot topilmadi', detail: `Tokenni tekshiring (${me.error})` });

  const hook = await tg(token, 'setWebhook', {
    url: webhookUrl,
    secret_token: webhookSecret(token),
    allowed_updates: ['message'],
  });
  rows.push({ ok: hook.ok, title: hook.ok ? 'Webhook o\'rnatildi' : 'Webhook o\'rnatilmadi', detail: hook.ok ? webhookUrl : hook.error });

  const guestCmds = await tg(token, 'setMyCommands', {
    commands: [{ command: 'start', description: 'Boshlash' }],
  });
  rows.push({ ok: guestCmds.ok, title: guestCmds.ok ? 'Umumiy buyruqlar sozlandi' : 'Umumiy buyruqlar sozlanmadi', detail: guestCmds.ok ? '/start' : guestCmds.error });

  if (adminChat) {
    const adminCmds = await tg(token, 'setMyCommands', {
      scope: { type: 'chat', chat_id: adminChat },
      commands: [
        { command: 'start', description: 'Buyruqlar ro\'yxati' },
        { command: 'bugun', description: 'Bugungi buyurtmalar soni va summasi' },
        { command: 'buyurtmalar', description: 'Oxirgi 10 ta buyurtma' },
        { command: 'savdo', description: 'Oxirgi 5 kundagi savdo' },
      ],
    });
    rows.push({ ok: adminCmds.ok, title: adminCmds.ok ? 'Buyurtmalar chatidagi buyruqlar sozlandi' : 'Buyurtmalar chatidagi buyruqlar sozlanmadi', detail: adminCmds.ok ? '/start, /bugun, /buyurtmalar, /savdo' : adminCmds.error });
  } else {
    rows.push({ ok: false, title: 'TELEGRAM_CHAT_ID topilmadi', detail: '/bugun, /buyurtmalar va /savdo buyruqlari ishlashi uchun uni Netlify → Environment variables ga qo\'shing.' });
  }

  const menu = await tg(token, 'setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Menyu', web_app: { url: siteUrl } },
  });
  rows.push({ ok: menu.ok, title: menu.ok ? '«Menyu» tugmasi sozlandi' : '«Menyu» tugmasi sozlanmadi', detail: menu.ok ? siteUrl : `${menu.error} (sayt manzili https bo'lishi kerak)` });

  const allOk = rows.every((r) => r.ok);
  return page(allOk ? 200 : 502, rows, allOk
    ? 'Hammasi tayyor. Botga /start yozib tekshiring.'
    : 'Ba\'zi sozlamalar bajarilmadi. Xatoni tuzatib, sahifani yangilang.');
};
