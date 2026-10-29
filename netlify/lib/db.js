// Buyurtmalar va menyu bazasi bilan ishlovchi umumiy modul
// (order.js, telegram.js, kochirish.js, zaxira.js, menyu.js, admin.js).
//  - Hostingda (PGDATABASE bor va "pg" paketi o'rnatilgan): o'sha serverdagi PostgreSQL.
//    Ulanish standart muhit o'zgaruvchilaridan: PGHOST (bo'lmasa localhost), PGDATABASE, PGUSER, PGPASSWORD.
//  - Aks holda (masalan, Netlify'da): Supabase REST — SUPABASE_URL, SUPABASE_SECRET_KEY.
// Fayl netlify/functions ichida emas — aks holda Netlify uni alohida funksiya qilib qo'yadi.

const i18n = require('./i18n');

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

// Eski jadvalga stol raqami ustuni (bo'lsa hech narsa qilmaydi).
const ADD_STOL = 'alter table buyurtmalar add column if not exists stol smallint';
// Buyurtma qaysi tildagi sahifadan kelgani: 'uz' yoki 'ru'.
const ADD_TIL = 'alter table buyurtmalar add column if not exists til text';

const CREATE_MENU = `
create table if not exists menyu (
  id          bigint generated always as identity primary key,
  nomi        text    not null unique,
  tavsif      text    not null default '',
  toifa       text    not null check (toifa in ('burger', 'lavash', 'extra', 'drink')),
  narx        integer not null check (narx >= 0),
  narx_matn   text,
  belgi       text,
  mavjud      boolean not null default true,
  tartib      integer not null default 0,
  yangilangan timestamptz not null default now()
)`;

// Ruscha maydonlar. nomi_ru null — hali to'ldirilmagan (fillMenuRu bir marta to'ldiradi);
// keyin ularni faqat admin o'zgartiradi (bo'sh bo'lsa '' yoziladi).
const ADD_MENU_RU = `
alter table menyu
  add column if not exists nomi_ru text,
  add column if not exists tavsif_ru text,
  add column if not exists narx_matn_ru text`;

const TOIFALAR = ['burger', 'lavash', 'extra', 'drink'];

// index.html dagi hozirgi menyu — jadval bo'sh bo'lsa shu bilan to'ldiriladi.
// [nomi, tavsif, toifa, narx, narx_matn, belgi]
const SEED_MENU = [
  ['Burger', "Klassik mol go'shtli burger", 'burger', 39000, null, null],
  ['Chizburger', 'Eritilgan pishloq bilan', 'burger', 42000, null, null],
  ['Bigchizburger', 'Ikki qavatli, katta portsiya', 'burger', 49000, null, 'HIT'],
  ['Lavash', "Yangi sabzavot va go'sht", 'lavash', 36000, null, null],
  ['Tandir lavash', 'Tandirda pishirilgan', 'lavash', 43000, null, null],
  ['Klab sendvich', 'Uch qavatli klassik sendvich', 'extra', 45000, null, null],
  ['Pitsa Peperoni', 'Butun oila uchun katta pitsa', 'extra', 105000, null, 'OILAVIY'],
  ['Moxito', 'Yalpiz va laym bilan salqin', 'drink', 55000, null, null],
  ['Coca-Cola', '1,5 litr', 'drink', 20000, null, null],
  ['Fanta', '1,5 litr', 'drink', 20000, null, null],
  ['Limon choy', "Issiq, limon bo'lagi bilan", 'drink', 30000, null, null],
  ['Qahva', "Xushbo'y, yangi damlangan", 'drink', 10000, null, null],
];

// Jadval bo'sh bo'lsagina to'ldiradi; bir vaqtda ikki jarayon ishga tushsa ham nom takrorlanmaydi.
async function seedMenu(p) {
  const params = [];
  const values = SEED_MENU.map((r, i) => {
    const b = params.length;
    params.push(r[0], r[1], r[2], r[3], r[4], r[5], (i + 1) * 10);
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}::integer, $${b + 5}::text, $${b + 6}::text, $${b + 7}::integer)`;
  });
  await p.query(
    `insert into menyu (nomi, tavsif, toifa, narx, narx_matn, belgi, tartib)
     select * from (values ${values.join(', ')}) as v
     where not exists (select 1 from menyu)
     on conflict (nomi) do nothing`,
    params
  );
}

// Ruscha nomi hali yo'q (null) taomlarni i18n/ru.js lug'ati bo'yicha bir marta to'ldiradi.
// Lug'atda yo'q taomga '' yoziladi — admin panelda «RU yo'q» bilan ko'rinadi.
async function fillMenuRu(p) {
  const { rows } = await p.query('select id, nomi, tavsif, narx_matn from menyu where nomi_ru is null');
  for (const r of rows) {
    await p.query(
      'update menyu set nomi_ru = $2, tavsif_ru = $3, narx_matn_ru = $4 where id = $1 and nomi_ru is null',
      [r.id, i18n.taomRu(r.nomi), i18n.taomRu(r.tavsif), i18n.narxMatnRu(r.narx_matn)]
    );
  }
}

let pool = null;
let ready = null;

// Birinchi murojaatda pul yaratiladi, jadvallar (bo'lmasa) yaratiladi va menyu to'ldiriladi.
function getPool() {
  if (!pool) {
    pool = new pg.Pool({ host: process.env.PGHOST || 'localhost', max: 3, connectionTimeoutMillis: 5000 });
    pool.on('error', (e) => console.error('PostgreSQL xatosi:', e.message));
  }
  if (!ready) {
    ready = (async () => {
      await pool.query(CREATE_TABLE);
      await pool.query(ADD_STOL);
      await pool.query(ADD_TIL);
      await pool.query(CREATE_MENU);
      await pool.query(ADD_MENU_RU);
      await seedMenu(pool);
      await fillMenuRu(pool);
    })().catch((e) => {
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

// row: { ism, telefon, izoh, taomlar, jami, rozilik, stol?, til? }. Xato bo'lsa istisno tashlaydi.
async function saveOrder(row) {
  if (usingPg) {
    await query(
      'insert into buyurtmalar (ism, telefon, izoh, taomlar, jami, rozilik, stol, til) values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)',
      [row.ism, row.telefon, row.izoh, JSON.stringify(row.taomlar), row.jami, row.rozilik === true, row.stol || null, row.til || 'uz']
    );
    return;
  }
  // Supabase jadvalida "stol" va "til" ustunlari yo'q — u yerga yozilmaydi (Telegram xabarida baribir bor).
  const { stol, til, ...rest } = row;
  const { url, headers } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/buyurtmalar`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rest),
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

// --- Menyu (faqat PostgreSQL) ---

const MENU_COLS = 'id, nomi, tavsif, toifa, narx, narx_matn, belgi, mavjud, tartib, nomi_ru, tavsif_ru, narx_matn_ru';
const MENU_CACHE_MS = 60000;
let menuCache = null; // { at, rows }

// Butun menyu tartib bo'yicha. Sayt uchun 60 soniya xotirada saqlanadi (admin o'zgartirsa tozalanadi).
async function menuList(fresh) {
  if (!fresh && menuCache && Date.now() - menuCache.at < MENU_CACHE_MS) return menuCache.rows;
  const { rows } = await query(`select ${MENU_COLS} from menyu order by tartib, id`);
  const list = rows.map((r) => ({ ...r, id: Number(r.id) }));
  menuCache = { at: Date.now(), rows: list };
  return list;
}

function menuChanged() {
  menuCache = null;
}

// Nomlar bo'yicha narx va mavjudlik: Map(nomi -> { narx, mavjud, nomi_ru }). Kesh ishlatilmaydi.
async function menuPrices(names) {
  const { rows } = await query('select nomi, narx, mavjud, nomi_ru from menyu where nomi = any($1::text[])', [names]);
  return new Map(rows.map((r) => [r.nomi, { narx: r.narx, mavjud: r.mavjud, nomi_ru: r.nomi_ru || '' }]));
}

// t: { nomi, tavsif, toifa, narx, nomi_ru, tavsif_ru }.
async function menuAdd(t) {
  await query(
    `insert into menyu (nomi, tavsif, toifa, narx, nomi_ru, tavsif_ru, narx_matn_ru, tartib)
     values ($1, $2, $3, $4, $5, $6, '', (select coalesce(max(tartib), 0) + 10 from menyu))`,
    [t.nomi, t.tavsif, t.toifa, t.narx, t.nomi_ru, t.tavsif_ru]
  );
  menuChanged();
}

// t: { nomi, tavsif, toifa, narx_matn, belgi, nomi_ru, tavsif_ru, narx_matn_ru }. Qator topilmasa false.
async function menuEdit(id, t) {
  const { rowCount } = await query(
    `update menyu set nomi = $2, tavsif = $3, toifa = $4, narx_matn = $5, belgi = $6,
       nomi_ru = $7, tavsif_ru = $8, narx_matn_ru = $9, yangilangan = now()
     where id = $1`,
    [id, t.nomi, t.tavsif, t.toifa, t.narx_matn, t.belgi, t.nomi_ru, t.tavsif_ru, t.narx_matn_ru]
  );
  menuChanged();
  return rowCount > 0;
}

async function menuSetPrice(id, narx) {
  const { rowCount } = await query('update menyu set narx = $2, yangilangan = now() where id = $1', [id, narx]);
  menuChanged();
  return rowCount > 0;
}

async function menuSetAvailable(id, mavjud) {
  const { rowCount } = await query('update menyu set mavjud = $2, yangilangan = now() where id = $1', [id, mavjud === true]);
  menuChanged();
  return rowCount > 0;
}

async function menuDelete(id) {
  const { rowCount } = await query('delete from menyu where id = $1', [id]);
  menuChanged();
  return rowCount > 0;
}

module.exports = {
  usingPg,
  TOIFALAR,
  menuList,
  menuPrices,
  menuAdd,
  menuEdit,
  menuSetPrice,
  menuSetAvailable,
  menuDelete,
  getPool,
  supabaseSelectAll,
  saveOrder,
  todayStats,
  lastOrders,
  ordersBetween,
  countOrders,
};
