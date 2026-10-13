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
