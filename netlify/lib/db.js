// Buyurtmalar bazasi bilan ishlovchi umumiy modul (order.js, telegram.js, kochirish.js, zaxira.js).
//  - Hostingda (PGDATABASE bor va "pg" paketi o'rnatilgan): o'sha serverdagi PostgreSQL.
//    Ulanish standart muhit o'zgaruvchilaridan: PGHOST (bo'lmasa localhost), PGDATABASE, PGUSER, PGPASSWORD.
//  - Aks holda (masalan, Netlify'da): Supabase REST — SUPABASE_URL, SUPABASE_SECRET_KEY.
// Fayl netlify/functions ichida emas — aks holda Netlify uni alohida funksiya qilib qo'yadi.

const PAGE = 1000; // Supabase bir so'rovda ko'pi bilan shuncha qator beradi

let pg = null;
if ((process.env.PGDATABASE || '').trim()) {
  try {
    pg = require('pg');
  } catch (e) {
    console.error('"pg" paketi o\'rnatilmagan — Supabase ishlatiladi');
  }
}

const usingPg = !!pg;
// Parol va manzil logga yozilmaydi.
console.log(usingPg ? 'Baza: hostingdagi PostgreSQL' : 'Baza: Supabase');

const CREATE_TABLE = `
create table if not exists buyurtmalar (
  id         bigint generated always as identity primary key,
  yaratilgan timestamptz not null default now(),
  ism        text    not null,
  telefon    text    not null,
  izoh       text    not null,
  taomlar    jsonb   not null,
  jami       integer not null,
  rozilik    boolean not null default false,
  holat      text    not null default 'yangi'
)`;

let pool = null;
let ready = null;

// Birinchi murojaatda pul yaratiladi va jadval (bo'lmasa) yaratiladi.
function getPool() {
  if (!pool) {
    pool = new pg.Pool({ host: process.env.PGHOST || 'localhost', max: 3 });
    pool.on('error', (e) => console.error('PostgreSQL xatosi:', e.message));
  }
  if (!ready) {
    ready = pool.query(CREATE_TABLE).catch((e) => {
      ready = null; // keyingi so'rovda qayta uriniladi
      throw e;
    });
  }
  return ready.then(() => pool);
}

async function query(text, params) {
  const p = await getPool();
  return p.query(text, params);
}

// --- Supabase REST ---

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !key) {
    const missing = [!url && 'SUPABASE_URL', !key && 'SUPABASE_SECRET_KEY'].filter(Boolean);
    throw new Error('Supabase sozlanmagan: ' + missing.join(', '));
  }
  return {
    url,
    headers: {
      apikey: key,
      // Eski service_role kaliti (JWT) Authorization'da ham yuboriladi;
      // yangi sb_secret_... kalitlari uchun apikey yetarli.
      ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    },
  };
}

async function supabaseSelect(queryString) {
  const { url, headers } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/buyurtmalar?${queryString}`, { headers });
  if (!res.ok) {
    throw new Error(`Supabase xatosi ${res.status}: ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

// Supabase'dagi qatorlarni sahifalab o'qiydi (har sahifada 1000 tagacha).
async function supabaseSelectAll(queryString) {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = await supabaseSelect(`${queryString}&limit=${PAGE}&offset=${offset}`);
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

// --- Umumiy funksiyalar ---

// row: { ism, telefon, izoh, taomlar, jami, rozilik }. Xato bo'lsa istisno tashlaydi.
async function saveOrder(row) {
  if (usingPg) {
    await query(
      'insert into buyurtmalar (ism, telefon, izoh, taomlar, jami, rozilik) values ($1, $2, $3, $4::jsonb, $5, $6)',
      [row.ism, row.telefon, row.izoh, JSON.stringify(row.taomlar), row.jami, row.rozilik === true]
    );
    return;
  }
  const { url, headers } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/buyurtmalar`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`Supabase xatosi ${res.status}: ${await res.text().catch(() => '')}`);
  }
}

// [fromIso, toIso) oralig'idagi buyurtmalar (yaratilgan, jami) — eskisidan yangisiga.
async function ordersBetween(fromIso, toIso) {
  if (usingPg) {
    const { rows } = await query(
      'select yaratilgan, jami from buyurtmalar where yaratilgan >= $1 and yaratilgan < $2 order by id',
      [fromIso, toIso]
    );
    return rows.map((r) => ({ yaratilgan: new Date(r.yaratilgan).toISOString(), jami: r.jami }));
  }
  const from = encodeURIComponent(fromIso);
  const to = encodeURIComponent(toIso);
  return supabaseSelectAll(`select=yaratilgan,jami&yaratilgan=gte.${from}&yaratilgan=lt.${to}&order=id.asc`);
}

// [fromIso, toIso) oralig'idagi buyurtmalar soni va jami summasi.
async function todayStats(fromIso, toIso) {
  if (usingPg) {
    const { rows } = await query(
      'select count(*) as count, coalesce(sum(jami), 0) as sum from buyurtmalar where yaratilgan >= $1 and yaratilgan < $2',
      [fromIso, toIso]
    );
    return { count: Number(rows[0].count), sum: Number(rows[0].sum) };
  }
  const rows = await ordersBetween(fromIso, toIso);
  return { count: rows.length, sum: rows.reduce((s, r) => s + (Number(r.jami) || 0), 0) };
}

// Oxirgi buyurtmalar: [{ yaratilgan, ism, telefon, jami }], yangisidan eskisiga.
async function lastOrders(limit) {
  const n = Math.max(1, Math.min(100, Math.floor(Number(limit)) || 10));
  if (usingPg) {
    const { rows } = await query(
      'select yaratilgan, ism, telefon, jami from buyurtmalar order by yaratilgan desc, id desc limit $1',
      [n]
    );
    return rows.map((r) => ({ yaratilgan: new Date(r.yaratilgan).toISOString(), ism: r.ism, telefon: r.telefon, jami: r.jami }));
  }
  return supabaseSelect(`select=yaratilgan,ism,telefon,jami&order=yaratilgan.desc&limit=${n}`);
}

// Hostingdagi jadvaldagi buyurtmalar soni (faqat PostgreSQL).
async function countOrders() {
  const { rows } = await query('select count(*) as n from buyurtmalar');
  return Number(rows[0].n);
}

module.exports = {
  usingPg,
  getPool,
  supabaseSelectAll,
  saveOrder,
  todayStats,
  lastOrders,
  ordersBetween,
  countOrders,
};
