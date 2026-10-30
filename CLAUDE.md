# Claude Code uchun doimiy qoidalar

Sayt: burgersmash.uz (American Fast Food, Termiz). Hostingda `server.js` (cPanel, Node.js 22) ishlaydi,
funksiyalar `netlify/functions/` da. Batafsil — README.md.

## Ish tartibi

- Shoxcha nomi doim `claude/` bilan boshlansin. PR `main` ga ochiladi.
- `claude/` shoxchadan egasi ochgan, qoralama bo'lmagan va `.github/` ga tegmagan PR testlar o'tsa
  **o'zi Merj bo'ladi** va saytga joylanadi. Shuning uchun PR'ni faqat ish tayyor bo'lganda oching
  (tayyor bo'lmasa — qoralama/draft qilib).
- Har o'zgarishda testlarni yangilang (`test/*.test.js`) va `npm test` o'tishini tekshiring.
  Testlar Node'ning o'z vositasida (`node --test`), og'ir kutubxona qo'shmang.
  Testlar haqiqiy Telegram'ga yozmasin va haqiqiy bazaga ulanmasin — `test/yordam/soxta.js` dan foydalaning.
- `.github/` dagi fayllarni o'zgartirsangiz, egasiga alohida ayting: bunday PR avtomatik Merj bo'lmaydi,
  uni egasi o'zi Merj qiladi.
- «Oxirgi o'zgarishni bekor qil» deyilsa: yangi `claude/` shoxchada `main` dagi oxirgi o'zgarishni
  `git revert` qiling va PR oching.

## Taqiqlar

- Dizayn va matnlarni so'ralmasa o'zgartirmang.
- Kalit, token va parollarni kodga yozmang — faqat muhit o'zgaruvchilari / GitHub Secrets.

## Tarjima

- O'zbekcha matn (`index.html`, `privacy.html`) o'zgarsa, ruschasini ham yangilang: `i18n/ru.js`
  (`matn`, JavaScript matnlari — `js`, buyurtma xatolari — `server`).
- Tekshirish: `node scripts/ru.js --check` (`npm test` ham buni tekshiradi).
