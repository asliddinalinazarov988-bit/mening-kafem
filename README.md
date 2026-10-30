# mening-kafem                                                                                                                                                         termez shahridagi talabalar va oqituvchilar uchun kafe                                                                                                                muammo:mijozlar telefon orqali buyurtma berishga qiynaladi                                                                                                            yechim sayt orqali 1 daqiqada buyurtma berish


## Buyurtmalarni Telegram'ga yuborish

Saytdagi «Buyurtma berish» formasi `netlify/functions/order.js` funksiyasi orqali buyurtmani Telegram'ga yuboradi.

Netlify'da sozlash: **Site configuration → Environment variables** bo'limiga qo'shing:

- `TELEGRAM_BOT_TOKEN` — @BotFather bergan bot tokeni
- `TELEGRAM_CHAT_ID` — buyurtmalar keladigan chat yoki guruh ID si

Har bir o'zgaruvchida **Scopes** ichida «Functions» belgilangan bo'lsin, **Deploy contexts** da esa «Production» bilan birga «Deploy Previews» ham yoqilgan bo'lsin (aks holda sinov versiyada «Buyurtma yuborilmadi» chiqadi). Keyin saytni qayta deploy qiling — o'zgaruvchilar faqat yangi deploydan keyin kuchga kiradi. Xato bo'lsa, qaysi o'zgaruvchi yetishmayotgani **Logs → Functions → order** da ko'rinadi. Hostingda menyu bazada saqlanadi va `/admin` orqali o'zgartiriladi (pastga qarang). Netlify'dagi (zaxira sayt) menyuni o'zgartirsangiz, `index.html` bilan birga `netlify/functions/order.js` dagi `MENU` ro'yxatini ham yangilang.

## Buyurtmalarni Supabase'ga saqlash

Mijoz formadagi rozilik belgisini qo'ymasa, buyurtma yuborilmaydi (`privacy.html` — maxfiylik siyosati). Har bir buyurtma Telegram'ga yuborilishidan oldin Supabase'dagi `buyurtmalar` jadvaliga yoziladi (ism, telefon, izoh, taomlar, jami, rozilik). Supabase ishlamasa ham buyurtma Telegram'ga baribir yetib boradi, xato esa **Logs → Functions → order** da ko'rinadi.

1. Supabase → **SQL Editor** da `supabase/buyurtmalar.sql` faylini bir marta ishga tushiring.
2. Netlify → **Environment variables** ga qo'shing (Scopes va Deploy contexts yuqoridagidek):
   - `SUPABASE_URL` — Supabase → Project Settings → API → Project URL
   - `SUPABASE_SECRET_KEY` — Project Settings → API Keys dagi **Secret key** (`sb_secret_...`) yoki eski **service_role** kaliti (maxfiy, faqat Netlify'da saqlang, kodga yozmang)
3. Saytni qayta deploy qiling.

## Telegram bot buyruqlari va Mini App

`netlify/functions/telegram.js` — bot webhook'i. Telegram so'rovi faqat `X-Telegram-Bot-Api-Secret-Token` sarlavhasi to'g'ri bo'lsa qabul qilinadi (maxfiy belgi `TELEGRAM_BOT_TOKEN` ning sha256 xeshidan birinchi 32 belgi, alohida o'zgaruvchi kerak emas).

Buyruqlar faqat `TELEGRAM_CHAT_ID` dagi chatda ishlaydi (ma'lumot Supabase'dagi `buyurtmalar` jadvalidan o'qiladi):

- `/start` — buyruqlar ro'yxati
- `/bugun` — bugungi (Toshkent vaqti) buyurtmalar soni va jami summasi
- `/buyurtmalar` — oxirgi 10 ta buyurtma: vaqt, ism, telefon, jami
- `/savdo` — oxirgi 5 kundagi savdo (bugun ham kiradi): har kun bo'yicha soni va summasi, oxirida jami

Boshqa har qanday chatga bot «Buyurtma berish uchun pastdagi «Menyu» tugmasini bosing» deb javob beradi.

Sozlash: deploydan keyin brauzerda `https://<sayt-manzili>/.netlify/functions/telegram-setup` ni bir marta oching. U webhook'ni shu saytga o'rnatadi, buyruqlar ro'yxatini va saytni Mini App qilib ochadigan «Menyu» tugmasini sozlaydi. Sayt manzili o'zgarsa, sahifani yangi manzilda qayta oching.

Sayt Telegram ichida ochilganda ism maydoni Telegram profilidagi ism bilan to'ldiriladi, buyurtma qabul qilingach «Telegram oynasini yopish» tugmasi chiqadi. Oddiy brauzerda sayt avvalgidek ishlaydi.

## Hostingga ko'chirish (cPanel, Node.js)

Sayt Netlify'da ham avvalgidek ishlaydi. Hostingda esa `server.js` statik fayllarni beradi va `/.netlify/functions/order`, `telegram`, `telegram-setup` so'rovlarini (shuningdek `kochirish`, `zaxira`) `netlify/functions/` dagi funksiyalarga uzatadi.

1. cPanel → **Setup Node.js App** → **Create Application**:
   - Node.js version: **22**
   - Application mode: **Production**
   - Application root: **americantermiz-app**
   - Application URL: sayt domeni
   - Application startup file: **server.js**
2. Shu sahifadagi **Environment variables** ga qo'shing:
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
   - baza uchun `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` (pastdagi bo'limga qarang)
   Keyin **Restart** ni bosing.
3. Avtomatik yuklash: GitHub → **Settings → Secrets and variables → Actions** ga qo'shing:
   - `FTP_SERVER` — `de.ahost.cloud`
   - `FTP_USERNAME` — cPanel logini
   - `FTP_PASSWORD` — cPanel paroli
   `main` ga har push bo'lganda «Hostingga yuklash» workflow'i fayllarni FTPS orqali `americantermiz-app` ga yuklaydi va `tmp/restart.txt` orqali ilovani qayta ishga tushiradi, keyin saytni tekshiradi (pastdagi «Avtomatik ish tartibi» bo'limiga qarang). Qo'lda ishga tushirish: **Actions → Hostingga yuklash → Run workflow**.
4. Birinchi yuklashdan keyin brauzerda `https://<sayt-manzili>/.netlify/functions/telegram-setup` ni oching — bot webhook'i yangi manzilga o'tadi (shundan keyin bot buyruqlari hostingdagi server orqali ishlaydi).

## Buyurtmalar bazasi hostingdagi PostgreSQL'da

Hostingda buyurtmalar o'sha serverdagi PostgreSQL'ga yoziladi (`netlify/lib/db.js`). Netlify'da (zaxira sayt) `PGDATABASE` yo'q, u yerda avvalgidek Supabase ishlatiladi. `/bugun`, `/buyurtmalar`, `/savdo` buyruqlari ham shu bazadan o'qiydi. Jadval birinchi ulanishda o'zi yaratiladi.

1. cPanel → **PostgreSQL Databases** da baza va foydalanuvchi yarating, foydalanuvchini bazaga qo'shing.
2. **Setup Node.js App** → **Environment variables** ga qo'shing (parolni kodga yozmang):
   - `PGHOST` — `localhost`
   - `PGDATABASE` — baza nomi
   - `PGUSER` — foydalanuvchi
   - `PGPASSWORD` — parol
3. Shu sahifada **«Установить NPM пакеты»** (Run NPM Install) ni bosing — `pg` paketi o'rnatiladi. Keyin **Restart**. Paket o'rnatilmaguncha sayt Supabase bilan ishlashda davom etadi.
4. Eski buyurtmalarni ko'chirish: brauzerda `https://DOMEN/.netlify/functions/kochirish` ni bir marta oching. Hostingdagi jadval bo'sh bo'lsa, Supabase'dagi barcha buyurtmalar (vaqti bilan) ko'chiriladi — «✅ N ta buyurtma ko'chirildi». Jadvalda buyurtma bo'lsa hech narsa qilinmaydi.
5. Kunlik zaxira: cPanel → **Cron Jobs** da har kuni 03:00 ga qo'shing:
   ```
   0 3 * * * curl -s https://DOMEN/.netlify/functions/zaxira > /dev/null
   ```
   Zaxira `~/zaxira/buyurtmalar-YYYY-MM-DD.sql.gz` ga saqlanadi va Telegram'dagi buyurtmalar chatiga yuboriladi. Kuniga bir marta olinadi (qayta ochilsa «bugun zaxira olingan» deydi), 14 kundan eski fayllar o'chiriladi.

Zaxiradan tiklash:

```
gunzip -c buyurtmalar-YYYY-MM-DD.sql.gz | psql -h localhost -U FOYDALANUVCHI BAZA
```

## Admin sahifa va stol QR-kodlari (hostingda)

Hostingda menyu PostgreSQL'dagi `menyu` jadvalida saqlanadi: jadval birinchi ulanishda o'zi yaratiladi va bo'sh bo'lsa `index.html` dagi taomlar bilan to'ldiriladi. Sayt menyuni `/.netlify/functions/menyu` dan oladi (60 soniyalik kesh), buyurtma narxi ham bazadan olinadi. Netlify'da (zaxira sayt) baza yo'q — u yerda `index.html` dagi menyu va `order.js` dagi `MENU` ishlaydi, `/admin` esa ochilmaydi.

1. cPanel → **Setup Node.js App** → **Environment variables** ga qo'shing:
   - `ADMIN_PAROL` — admin paroli, kamida 10 belgi (kodga yozmang). Bo'lmasa yoki qisqa bo'lsa, kirish yopiq bo'ladi.
2. Shu sahifada **«Установить NPM пакеты»** (Run NPM Install) ni bosing — QR-kodlar uchun `qrcode` paketi o'rnatiladi. Keyin **Restart**.
3. Brauzerda `https://DOMEN/admin` ni oching va parol bilan kiring (sessiya 30 kun saqlanadi, «Chiqish» tugmasi bor). Bitta IP'dan 15 daqiqada 5 tadan ko'p noto'g'ri parol kiritilsa — «Biroz kuting».
   - Har bir taomda: narxni o'zgartirish, «Tugadi / Bor» (tugagan taom saytda kulrang, «Tugadi» yorlig'i bilan chiqadi va savatga qo'shilmaydi), tahrirlash (nomi, tavsif, toifa, narx matni, belgi), o'chirish.
   - «Yangi taom» — nomi, tavsif, toifa, narx.
   - Diqqat: barcha taomlar o'chirilsa, keyingi qayta ishga tushishda jadval yana `index.html` dagi menyu bilan to'ldiriladi.
4. **Stol QR-kodlari**: admin sahifasida stollar sonini kiriting → chop etishga tayyor sahifa ochiladi (A4 ga 6 ta). Har bir QR `https://DOMEN/?stol=N` ni ochadi: savatda va buyurtma oynasida «🪑 Stol N» ko'rinadi, Telegram xabarida «🪑 Stol N» qatori chiqadi va stol raqami bazaga (`buyurtmalar.stol`) yoziladi.

Baza javob bermasa, buyurtma baribir Telegram'ga yuboriladi (narx `order.js` dagi `MENU` dan), xabarda «⚠️ Narxlar tekshirilmadi (baza javob bermadi)» qatori bo'ladi.

## Ruscha versiya (/ru) va Yandex Metrika

- **Manzillar:** `/ru` (yoki `/ru/`) — saytning ruscha versiyasi, `/ru/privacy` — maxfiylik siyosatining ruschasi. Ruscha matnlar sahifa HTML'ida serverdan tayyor keladi (JavaScript'siz ham ko'rinadi). Ikkala tilda `hreflang` (uz, ru, x-default = uz) va `canonical` bor.
- **Til lug'ati:** barcha ruscha matnlar `i18n/ru.js` da. O'zbekcha matnlar `index.html` va `privacy.html` da qoladi; ruscha sahifa ulardan `netlify/lib/i18n.js` orqali yasaladi (hostingda `server.js` so'rov paytida, Netlify'da build paytida `node netlify/lib/i18n.js` buyrug'i `ru/` papkasiga yozadi). `index.html` ga yangi matn qo'shsangiz, tarjimasini `i18n/ru.js` dagi `matn` ga qo'shing; tekshirish: `node netlify/lib/i18n.js` — tarjimasi yo'q matnlarni ko'rsatadi. JavaScript matnlari (`<script id="matnlar">`) ruschasi — `js` bo'limida, buyurtma xatolari — `server` bo'limida.
- **Til tugmasi** «UZ | RU» sarlavhada. Bosilganda joriy bo'lim (`#menyu` va h.k.) va `?stol=N` saqlanadi, savat ham yo'qolmaydi. Tanlov brauzerda eslab qolinadi: ruscha tanlangan bo'lsa, keyingi safar bosh sahifa ochilganda `/ru` ga o'tadi. Birinchi kirishda avtomatik yo'naltirish yo'q.
- **Menyuning ruscha maydonlari:** `menyu` jadvalida `nomi_ru`, `tavsif_ru`, `narx_matn_ru` ustunlari (o'zi qo'shiladi). Mavjud taomlar uchun ular birinchi ishga tushishda bir marta `i18n/ru.js` lug'atidan to'ldiriladi («so'm» → «сум», «ming» → «тыс.»), keyin ularni faqat admin o'zgartiradi: `/admin` da «Tahrirlash» ichida «Nomi (RU)», «Tavsif (RU)», «Narx matni (RU)», «Yangi taom» da «Nomi (RU)», «Tavsif (RU)». Ruscha nomi yo'q taom ro'yxatda «RU yo'q» belgisi bilan ko'rinadi. `/ru` sahifada ruscha maydon bo'sh bo'lsa, o'zbekchasi ko'rsatiladi. Savat va narx tekshiruvi taomning o'zbekcha nomi bo'yicha ishlaydi.
- **Buyurtmada til:** ruscha sahifadan kelgan buyurtmada Telegram xabarida «🌐 RU» qatori chiqadi va bazadagi `buyurtmalar.til` ustuniga `ru` yoziladi (o'zbekchada `uz`). Telegram xabari o'zbekcha qoladi.
- **Yandex Metrika:** hisoblagich raqami **113894435** — `index.html` va `privacy.html` da (`ym(...)` va `noscript` dagi `mc.yandex.ru/watch/...`, shuningdek `index.html` dagi `YM_ID`). Raqam o'zgarsa, shu joylarda almashtiring (ruscha sahifalar avtomatik yangilanadi). Clickmap, trackLinks, accurateTrackBounce va Vebvizor yoqilgan; buyurtma oynasidagi ism, telefon va izoh maydonlarida `ym-disable-keys` — Vebvizor ularning ichini yozmaydi. Admin sahifada Metrika yo'q.
- **«buyurtma» maqsadi:** buyurtma muvaffaqiyatli yuborilgach `ym(113894435, 'reachGoal', 'buyurtma', { order_price: jami, currency: 'UZS' })` chaqiriladi. Metrika → **Maqsadlar** da «JavaScript-hodisa» turidagi maqsad yarating, identifikator — `buyurtma`. Metrika yuklanmasa ham buyurtma ishlayveradi.

## Avtomatik ish tartibi

Siz Claude Code'ga vazifa berasiz → u `claude/...` shoxchada ishlab PR ochadi → testlar o'tsa PR o'zi Merj bo'ladi → sayt joylanadi → joylashdan keyin sayt tekshiriladi → natija Telegram'ga keladi.

**Workflow'lar** (`.github/workflows/`):

- **Tekshiruv** (`tekshiruv.yml`) — har PR'da va `main` ga har push'da `npm test`.
- **Avtomatik Merj** (`avto-merj.yml`) — PR `main` ga ochilganda yoki yangilanganda.
- **Hostingga yuklash** (`deploy-hosting.yml`) — yuklash, tekshirish, kerak bo'lsa eski versiyani qaytarish.
- **Sayt nazorati** (`sayt-nazorati.yml`) — har 30 daqiqada sayt ochilishini tekshiradi.

**Testlar** (`npm test`, `test/` papkasi, Node'ning o'z `node --test` vositasi): `server.js` bazasiz va Telegram'siz ishga tushadi (`test/yordam/soxta.js` — xotiradagi soxta baza va soxta Telegram), `/`, `/ru/`, `/privacy`, `/ru/privacy`, `/admin` va menyu ma'lumoti ochilishi, sahifalarda Metrika, hreflang va asosiy bo'limlar borligi; `node scripts/ru.js --check` (tarjimasi yo'q matn yo'qligi); buyurtma funksiyasi bo'sh ism, noto'g'ri telefon, menyuda yo'q taom va o'zgartirilgan narxni rad etishi.

### Qaysi PR avtomatik Merj bo'ladi

Faqat hammasi bajarilsa:

1. shoxcha nomi `claude/` bilan boshlanadi;
2. PR'ni repozitoriy egasi ochgan (fork'dan emas);
3. PR qoralama (draft) emas;
4. PR `.github/` papkasidagi fayllarni o'zgartirmaydi.

Testlar o'tsa — **squash Merj**, keyin «Hostingga yuklash» ishga tushiriladi. Testlar o'tmasa Merj qilinmaydi (workflow qizil bo'ladi, Claude tuzatib qayta push qilsa yana tekshiriladi).

### Qaysi PR'ni o'zingiz Merj qilasiz

- `.github/` ni o'zgartirgan PR — unga «Bu PR'ni egasi o'zi Merj qiladi» degan izoh qoldiriladi. Workflow'lar sizning sayt va kalitlaringizni boshqaradi, shuning uchun ularni o'zingiz ko'rib chiqasiz;
- boshqa nomdagi shoxchalar (masalan, GitHub'dagi «Revert» tugmasi ochgan `revert-...` PR), qoralama PR'lar.

Ularni GitHub'da **Merge pull request** bilan Merj qiling — `main` ga push bo'lgani uchun joylash o'zi ishga tushadi.

### Joylashdan keyin

«Hostingga yuklash» oxirida 1,5 daqiqa kutib, `/`, `/ru/`, `/privacy` va menyu ma'lumoti (`/.netlify/functions/menyu`) ochilishi va kutilgan matn borligi tekshiriladi (`scripts/sayt-tekshir.js`):

- o'tsa — Telegram'ga «✅ Sayt yangilandi» + o'zgarish nomi + GitHub havolasi;
- menyu ma'lumoti hozircha faqat ogohlantirish beradi: u o'tmasa sayt qaytarilmaydi, «✅» xabarida «⚠️» qatori va javobning boshi chiqadi (2026-10-30 dagi joylashda menyu javobi kutilgandek bo'lmagan, sababi aniqlanguncha);
- `/`, `/ru/` yoki `/privacy` o'tmasa — `main` ga oxirgi o'zgarishni bekor qiluvchi (revert) commit qo'shiladi, eski versiya alohida papkada (`.eski/`) yasalib qayta yuklanadi va yana tekshiriladi: «❌ Yangilanish ishlamadi, eski versiya qaytarildi» + sabab;
- qaytarishdan keyin ham ochilmasa — «🆘 Sayt ochilmayapti, darhol tekshiring»;
- FTP yuklash o'zi xato bersa — «❌ Saytga yuklab bo'lmadi (FTP)».

Muvaffaqiyatsiz yangilanishdan keyin workflow qizil bo'ladi. Revert'dan keyin xatoni tuzatish uchun Claude'ga yangi vazifa bering.

### «Oxirgi o'zgarishni bekor qil»

- **Claude orqali:** Claude Code'ga «Oxirgi o'zgarishni bekor qil» deb yozing. U `claude/` shoxchada `git revert` qilib PR ochadi — testlar o'tsa o'zi Merj bo'ladi va eski versiya joylanadi.
- **O'zingiz:** GitHub'da Merj qilingan PR'ni oching → **Revert** → ochilgan PR'ni **Merge pull request** bilan Merj qiling.

### Sayt nazorati

Har 30 daqiqada (va **Actions → Sayt nazorati → Run workflow** bilan qo'lda) `burgersmash.uz` va `/ru/` tekshiriladi. Ochilmasa 1 daqiqadan keyin qayta tekshiriladi; yana ochilmasa — Telegram'ga «🔴 Sayt ochilmayapti» va workflow qizil. Sayt tuzalmaguncha «🔴» har 30 daqiqada takrorlanmaydi; qayta ishlaganda bir marta «🟢 Sayt yana ishlayapti» keladi. GitHub jadvaldagi ishga tushishni ba'zan 5–15 daqiqaga kechiktiradi; repozitoriyda 60 kun hech qanday o'zgarish bo'lmasa, jadval o'chib qoladi (Actions sahifasida qayta yoqiladi).

### Sozlash (bir marta)

GitHub → **Settings → Secrets and variables → Actions**:

- **Secrets:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (xabarlar shu chatga keladi; qiymatlarni kodga yozmang). Bo'lmasa workflow'lar yiqilmaydi, faqat ogohlantirish chiqaradi. `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` — yuqorida.
- **Variables (ixtiyoriy):** `SAYT_URL` — tekshiriladigan manzil, bo'lmasa `https://burgersmash.uz`.

Shuningdek: **Settings → General → Pull Requests** da «Allow squash merging» yoqilgan bo'lsin. `main` ga himoya qoidasi (majburiy review) qo'yilsa, avtomatik Merj va revert push ishlamaydi.

### Actions daqiqalari

Repozitoriy ochiq (public) — GitHub'ning oddiy runner'lari uchun daqiqalar **bepul va cheksiz**. Taxminiy sarf (GitHub har job'ni yuqoriga, butun daqiqaga yaxlitlaydi):

| Workflow | Bir marta | Oyiga taxminan |
|---|---|---|
| Tekshiruv | ~1 daqiqa | har PR push'ida va `main` push'ida |
| Avtomatik Merj | ~3 daqiqa (shartlar + test + Merj) | har PR yangilanishida |
| Hostingga yuklash | ~3–4 daqiqa (qaytarish bilan ~7) | har joylashda |
| Sayt nazorati | ~1 daqiqa (sayt ochilmasa ~2) | 48 marta/kun ≈ **1 440 daqiqa** |

Agar repozitoriy yopiq (private) qilinsa, bepul limit oyiga 2 000 daqiqa — uning katta qismini Sayt nazorati oladi; u holda `sayt-nazorati.yml` dagi jadvalni soatiga bir martaga (`0 * * * *`) o'zgartiring.
