// Sayt menyusini JSON qilib beradi: GET /.netlify/functions/menyu
//  - faqat hostingda (PGDATABASE bor) ishlaydi, aks holda 404 — sayt index.html dagi menyuni ko'rsatadi;
//  - 60 soniyalik kesh (serverda va brauzerda).

const db = require('../lib/db');

function reply(statusCode, data, cache) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache ? 'public, max-age=60' : 'no-store',
    },
    body: JSON.stringify(data),
  };
}

exports.handler = async (event) => {
  if (!db.usingPg) return reply(404, { ok: false, error: 'Topilmadi' });
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return reply(405, { ok: false, error: "Ruxsat etilmagan so'rov" });
  }
  try {
    const rows = await db.menuList();
    const taomlar = rows.map((r) => ({
      nomi: r.nomi,
      tavsif: r.tavsif,
      toifa: r.toifa,
      narx: r.narx,
      narx_matn: r.narx_matn || null,
      belgi: r.belgi || null,
      mavjud: r.mavjud,
    }));
    return reply(200, { ok: true, taomlar }, true);
  } catch (e) {
    console.error('[menyu]', e.message);
    return reply(503, { ok: false, error: 'Menyu olinmadi' });
  }
};
