# mening-kafem                                                                                                                                                         termez shahridagi talabalar va oqituvchilar uchun kafe                                                                                                                muammo:mijozlar telefon orqali buyurtma berishga qiynaladi                                                                                                            yechim sayt orqali 1 daqiqada buyurtma berish


## Buyurtmalarni Telegram'ga yuborish

Saytdagi «Buyurtma berish» formasi `netlify/functions/order.js` funksiyasi orqali buyurtmani Telegram'ga yuboradi.

Netlify'da sozlash: **Site configuration → Environment variables** bo'limiga qo'shing:

- `TELEGRAM_BOT_TOKEN` — @BotFather bergan bot tokeni
- `TELEGRAM_CHAT_ID` — buyurtmalar keladigan chat yoki guruh ID si

Har bir o'zgaruvchida **Scopes** ichida «Functions» belgilangan bo'lsin, **Deploy contexts** da esa «Production» bilan birga «Deploy Previews» ham yoqilgan bo'lsin (aks holda sinov versiyada «Buyurtma yuborilmadi» chiqadi). Keyin saytni qayta deploy qiling — o'zgaruvchilar faqat yangi deploydan keyin kuchga kiradi. Xato bo'lsa, qaysi o'zgaruvchi yetishmayotgani **Logs → Functions → order** da ko'rinadi. Menyuga taom qo'shsangiz yoki narxni o'zgartirsangiz, `index.html` bilan birga `netlify/functions/order.js` dagi `MENU` ro'yxatini ham yangilang.

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
   `main` ga har push bo'lganda «Hostingga yuklash» workflow'i fayllarni FTPS orqali `americantermiz-app` ga yuklaydi va `tmp/restart.txt` orqali ilovani qayta ishga tushiradi. Qo'lda ishga tushirish: **Actions → Hostingga yuklash → Run workflow**.
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
