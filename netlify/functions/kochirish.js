// Bir martalik ko'chirish: brauzerda /.netlify/functions/kochirish ni oching.
//  - faqat hostingda (PGDATABASE bor) ishlaydi;
//  - hostingdagi "buyurtmalar" jadvali bo'sh bo'lsagina Supabase'dagi barcha buyurtmalarni
//    (id va yaratilgan vaqti bilan) ko'chiradi va id ketma-ketligini to'g'rilaydi;
//  - jadvalda buyurtma bo'lsa hech narsa qilmaydi, shuning uchun qayta ochish xavfsiz.
// Supabase kalitlari: SUPABASE_URL, SUPABASE_SECRET_KEY. Kalitlar sahifada ko'rsatilmaydi.

const db = require('../lib/db');

const BATCH = 100; // bitta insert'da shuncha qator

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(statusCode, message, detail) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    body: `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Buyurtmalarni ko'chirish</title>
<style>
  body{margin:0;background:#0b0b0b;color:#f5f5f5;font-family:Montserrat,system-ui,sans-serif;padding:32px 16px}
  main{max-width:560px;margin:0 auto}
  h1{color:#d4af37;font-size:24px;margin:0 0 20px}
  .box{background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:14px;margin-bottom:10px}
  .box.bad{border-color:#e05a5a}
  b{display:block}
  small{display:block;color:#aaa;margin-top:4px;word-break:break-word}
</style>
</head>
<body><main><h1>Buyurtmalarni ko'chirish</h1><div class="box${statusCode >= 400 ? ' bad' : ''}"><b>${esc(message)}</b>${detail ? `<small>${esc(detail)}</small>` : ''}</div></main></body>
</html>`,
  };
}

const COLUMNS = ['id', 'yaratilgan', 'ism', 'telefon', 'izoh', 'taomlar', 'jami', 'holat', 'rozilik'];

async function insertBatch(client, rows) {
  const params = [];
  const values = rows.map((r) => {
    const base = params.length;
    params.push(
      r.id,
      r.yaratilgan,
      r.ism,
      r.telefon,
      r.izoh,
      JSON.stringify(r.taomlar == null ? [] : r.taomlar),
      r.jami,
      r.holat || 'yangi',
      r.rozilik === true
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb, $${base + 7}, $${base + 8}, $${base + 9})`;
  });
  await client.query(
    `insert into buyurtmalar (${COLUMNS.join(', ')}) overriding system value values ${values.join(', ')}`,
    params
  );
}

exports.handler = async () => {
  if (!db.usingPg) {
    return page(400, 'Bu sahifa faqat hostingda ishlaydi', 'PGDATABASE muhit o\'zgaruvchisi yoki "pg" paketi topilmadi.');
  }

  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();
    await client.query('begin');
    // Bir vaqtda ikki marta ochilsa ham ko'chirish faqat bir marta bajariladi.
    await client.query('lock table buyurtmalar in exclusive mode');

    const { rows: countRows } = await client.query('select count(*) as n from buyurtmalar');
    const existing = Number(countRows[0].n);
    if (existing > 0) {
      await client.query('rollback');
      return page(200, `ℹ️ Jadvalda allaqachon ${existing} ta buyurtma bor`, 'Hech narsa ko\'chirilmadi.');
    }

    const rows = await db.supabaseSelectAll(`select=${COLUMNS.join(',')}&order=id.asc`);
    for (let i = 0; i < rows.length; i += BATCH) {
      await insertBatch(client, rows.slice(i, i + BATCH));
    }
    // Yangi buyurtmalar ko'chirilgan eng katta id dan keyingi raqamdan boshlanadi.
    await client.query(
      "select setval(pg_get_serial_sequence('buyurtmalar', 'id'), coalesce(max(id), 1), max(id) is not null) from buyurtmalar"
    );
    await client.query('commit');
    return page(200, `✅ ${rows.length} ta buyurtma ko'chirildi`, '');
  } catch (e) {
    if (client) await client.query('rollback').catch(() => {});
    console.error('[kochirish]', e.message);
    return page(500, '❌ Ko\'chirib bo\'lmadi', e.message.slice(0, 300));
  } finally {
    if (client) client.release();
  }
};
