// Testlar uchun soxta tashqi dunyo (node -r test/yordam/soxta.js yoki require bilan yuklanadi):
//  - require('pg') -> xotirada ishlaydigan soxta baza (haqiqiy PostgreSQL'ga ulanilmaydi);
//  - fetch -> Telegram so'rovlari yoziladi, lekin hech qayerga yuborilmaydi; boshqa tarmoq so'rovlari xato beradi.
// Yuborilgan so'rovlar globalThis.soxta.fetchlar da, bazadagi qatorlar globalThis.soxta.baza da.

const Module = require('module');
const path = require('path');

const baza = { menyu: [], buyurtmalar: [] };
const fetchlar = [];
globalThis.soxta = { baza, fetchlar };

class Pool {
  on() {}
  async query(text, params = []) {
    const sql = String(text).replace(/\s+/g, ' ').trim().toLowerCase();
    const ok = (rows = [], rowCount = rows.length) => ({ rows, rowCount });

    if (sql.startsWith('create table') || sql.startsWith('alter table')) return ok();

    // seedMenu: 7 tadan parametr — nomi, tavsif, toifa, narx, narx_matn, belgi, tartib.
    if (sql.startsWith('insert into menyu (nomi, tavsif, toifa, narx, narx_matn, belgi, tartib)')) {
      if (baza.menyu.length) return ok();
      for (let i = 0; i < params.length; i += 7) {
        const [nomi, tavsif, toifa, narx, narx_matn, belgi, tartib] = params.slice(i, i + 7);
        baza.menyu.push({
          id: baza.menyu.length + 1, nomi, tavsif, toifa, narx, narx_matn, belgi, tartib,
          mavjud: true, nomi_ru: null, tavsif_ru: null, narx_matn_ru: null,
        });
      }
      return ok([], params.length / 7);
    }
    if (sql.startsWith('select id, nomi, tavsif, narx_matn from menyu where nomi_ru is null')) {
      return ok(baza.menyu.filter((r) => r.nomi_ru === null));
    }
    if (sql.startsWith('update menyu set nomi_ru = $2')) {
      const r = baza.menyu.find((x) => x.id === params[0] && x.nomi_ru === null);
      if (r) Object.assign(r, { nomi_ru: params[1], tavsif_ru: params[2], narx_matn_ru: params[3] });
      return ok([], r ? 1 : 0);
    }
    if (sql.startsWith('select nomi, narx, mavjud, nomi_ru from menyu where nomi = any')) {
      return ok(baza.menyu.filter((r) => params[0].includes(r.nomi)));
    }
    if (sql.startsWith('select') && sql.includes('from menyu order by')) {
      return ok([...baza.menyu].sort((a, b) => a.tartib - b.tartib || a.id - b.id));
    }
    if (sql.startsWith('insert into buyurtmalar')) {
      baza.buyurtmalar.push(params);
      return ok([], 1);
    }
    throw new Error('Soxta baza bu so\'rovni bilmaydi: ' + sql.slice(0, 80));
  }
  async end() {}
}

const FAKE_PG = path.join(__dirname, 'soxta-pg.js');
require.cache[FAKE_PG] = Object.assign(new Module(FAKE_PG), { id: FAKE_PG, filename: FAKE_PG, loaded: true, exports: { Pool } });
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'pg') return FAKE_PG;
  return resolve.call(this, request, ...rest);
};

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  fetchlar.push({ url, body: opts.body });
  if (url.startsWith('https://api.telegram.org/')) {
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('Testda tarmoq yopiq: ' + url);
};
