# mening-kafem                                                                                                                                                         termez shahridagi talabalar va oqituvchilar uchun kafe                                                                                                                muammo:mijozlar telefon orqali buyurtma berishga qiynaladi                                                                                                            yechim sayt orqali 1 daqiqada buyurtma berish


## Buyurtmalarni Telegram'ga yuborish

Saytdagi «Buyurtma berish» formasi `netlify/functions/order.js` funksiyasi orqali buyurtmani Telegram'ga yuboradi.

Netlify'da sozlash: **Site configuration → Environment variables** bo'limiga qo'shing:

- `TELEGRAM_BOT_TOKEN` — @BotFather bergan bot tokeni
- `TELEGRAM_CHAT_ID` — buyurtmalar keladigan chat yoki guruh ID si

Keyin saytni qayta deploy qiling. Menyuga taom qo'shsangiz yoki narxni o'zgartirsangiz, `index.html` bilan birga `netlify/functions/order.js` dagi `MENU` ro'yxatini ham yangilang.
