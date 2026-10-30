// Saytning ruscha tarjimasi — barcha ruscha matnlar shu faylda.
// O'zbekcha matnlar index.html va privacy.html da qoladi; /ru va /ru/privacy sahifalari
// ulardan netlify/lib/i18n.js orqali yasaladi.
//
// Yangi o'zbekcha matn qo'shsangiz, uning tarjimasini «matn» ga qo'shing (kalit — o'zbekcha matn,
// bo'sh joylar farqi hisobga olinmaydi). Tekshirish: `node netlify/lib/i18n.js` — tarjimasi yo'q
// matnlarni ko'rsatadi (ru/ papkasiga yozilgan fayllar git'ga qo'shilmaydi).
// «so'm» va «ming» bilan yozilgan narxlar («39 000 so'm») avtomatik «39 000 сум» ga aylanadi.

module.exports = {
  // Sahifadagi matnlar va alt/aria-label/placeholder/title/meta content qiymatlari: o'zbekcha -> ruscha.
  matn: {
    // --- index.html: sarlavha va meta ---
    'American — Fast Food': 'American — фастфуд',
    "American Fast Food — oilaviy ovqatlanish uchun qulay, tinch va hamyonbop haqiqiy amerikancha ta'm.":
      'American Fast Food — уютное, спокойное и недорогое место для всей семьи с настоящим американским вкусом.',

    // --- Sarlavha (header) ---
    'American bosh sahifa': 'American — главная страница',
    'Menyu': 'Меню',
    'Qulayliklar': 'Удобства',
    'Joy band qilish': 'Бронирование',
    'Aloqa': 'Контакты',
    'Til': 'Язык',

    // --- Hero ---
    'Bugun ochiq · 9:00 – 23:00': 'Сегодня открыто · 9:00 – 23:00',
    "Oilaviy ovqatlanish uchun qulay, tinch va hamyonbop — haqiqiy amerikancha ta'm.":
      'Уютно, спокойно и недорого — настоящий американский вкус для всей семьи.',
    'Joy band qiling': 'Забронировать стол',
    "Menyuni ko'ring": 'Смотреть меню',
    'Har kuni': 'Ежедневно',
    '20 ta stol': '20 столов',
    'Rozetkali': 'С розетками',
    'Bepul Wi-Fi': 'Бесплатный Wi-Fi',
    'Tinch zona': 'Тихая зона',
    'American logotipi': 'Логотип American',

    // --- Menyu ---
    'Xizmatlar va menyu': 'Услуги и меню',
    'Bizning': 'Наше',
    'menyu': 'меню',
    'Hammasi': 'Все',
    'Burgerlar': 'Бургеры',
    'Ichimliklar': 'Напитки',
    'Savatga': 'В корзину',
    'HIT': 'ХИТ',
    'OILAVIY': 'ДЛЯ СЕМЬИ',

    // Taomlar: nomi va tavsifi. Bazadagi menyuning ruscha ustunlari (nomi_ru, tavsif_ru)
    // bo'sh bo'lsa, birinchi ishga tushishda bir marta shu yerdan to'ldiriladi.
    'Burger': 'Бургер',
    "Klassik mol go'shtli burger": 'Классический бургер с говядиной',
    'Chizburger': 'Чизбургер',
    'Eritilgan pishloq bilan': 'С расплавленным сыром',
    'Bigchizburger': 'Биг-чизбургер',
    'Ikki qavatli, katta portsiya': 'Двойной, большая порция',
    'Lavash': 'Лаваш',
    "Yangi sabzavot va go'sht": 'Свежие овощи и мясо',
    'Tandir lavash': 'Тандыр-лаваш',
    'Tandirda pishirilgan': 'Приготовлен в тандыре',
    'Klab sendvich': 'Клаб-сэндвич',
    'Uch qavatli klassik sendvich': 'Классический трёхслойный сэндвич',
    'Pitsa Peperoni': 'Пицца Пепперони',
    'Butun oila uchun katta pitsa': 'Большая пицца на всю семью',
    'Moxito': 'Мохито',
    'Yalpiz va laym bilan salqin': 'Освежающий, с мятой и лаймом',
    '1,5 litr': '1,5 л',
    'Limon choy': 'Чай с лимоном',
    "Issiq, limon bo'lagi bilan": 'Горячий, с долькой лимона',
    'Qahva': 'Кофе',
    "Xushbo'y, yangi damlangan": 'Ароматный, свежесваренный',

    // --- Savat va buyurtma oynasi ---
    'Savat': 'Корзина',
    '0 ta taom': '0 блюд',
    "Savat bo'sh. Menyudan taom tanlang.": 'Корзина пуста. Выберите блюда в меню.',
    'Jami:': 'Итого:',
    'Buyurtma berish': 'Оформить заказ',
    'Buyurtmangiz': 'Ваш заказ',
    'Ismingiz': 'Ваше имя',
    'Masalan: Aziz': 'Например: Азиз',
    'Telefon raqamingiz': 'Номер телефона',
    'Manzil yoki izoh': 'Адрес или комментарий',
    "Masalan: Termiz, Al-Hakim at-Termiziy ko'chasi 12 yoki «Olib ketaman»":
      'Например: Термез, ул. Ал-Хаким ат-Термизи, 12 или «Заберу сам»',
    "Ma'lumotlarim buyurtmani bajarish uchun ishlatilishiga roziman.":
      'Согласен(на) на использование моих данных для выполнения заказа.',
    'Maxfiylik siyosati': 'Политика конфиденциальности',
    "Bu maydonni bo'sh qoldiring": 'Оставьте это поле пустым',
    'Buyurtma yuborilmadi.': 'Заказ не отправлен.',
    "Iltimos, qo'ng'iroq qiling:": 'Пожалуйста, позвоните нам:',
    'Yuborish': 'Отправить',
    'Savatga qaytish': 'Вернуться в корзину',
    'Rahmat! Buyurtmangiz qabul qilindi': 'Спасибо! Ваш заказ принят',
    "Tez orada siz bilan bog'lanamiz.": 'Мы скоро с вами свяжемся.',
    'Menyuga qaytish': 'Вернуться в меню',

    // --- Qulayliklar ---
    "Tez internet — ishlash, o'qish yoki dam olish uchun.": 'Быстрый интернет — для работы, учёбы или отдыха.',
    "Shovqinsiz muhit — oila bilan yoki yolg'iz xotirjam o'tiring.":
      'Без шума — спокойно посидите с семьёй или в одиночку.',
    'Rozetka — 20 ta stolda': 'Розетки — у 20 столов',
    'Noutbuk va telefoningizni bemalol quvvatlang.': 'Спокойно заряжайте ноутбук и телефон.',
    'Printer': 'Принтер',
    'Hujjatlarni joyida chop etish imkoniyati.': 'Можно распечатать документы прямо на месте.',
    'Zaryadlash': 'Зарядка',
    'Telefon uchun zaryadlovchi qurilmalar mavjud.': 'Есть зарядные устройства для телефона.',
    'Kitoblar': 'Книги',
    "Kitob o'qib, qahva bilan vaqtni maroqli o'tkazing.": 'Читайте книги и приятно проводите время за чашкой кофе.',

    // --- Joy band qilish va aloqa ---
    'Ish vaqti': 'Время работы',
    'Har kuni 9:00 dan 23:00 gacha': 'Ежедневно с 9:00 до 23:00',
    'Telefon': 'Телефон',
    'Joylar': 'Места',
    '20 ta qulay stol, barchasida rozetka': '20 удобных столов, у каждого — розетка',
    'Sana': 'Дата',
    'Vaqt': 'Время',
    'Mehmonlar soni': 'Количество гостей',
    '1 kishi': '1 человек',
    '2 kishi': '2 человека',
    '3 kishi': '3 человека',
    '4 kishi': '4 человека',
    '5 kishi': '5 человек',
    '6 kishi': '6 человек',
    '7+ kishi': '7+ человек',
    'Rahmat,': 'Спасибо,',
    "Qo'ng'iroq qilib tasdiqlash": 'Позвонить и подтвердить',

    // --- Footer ---
    "Haqiqiy amerikancha ta'm — oilangiz bilan birga.": 'Настоящий американский вкус — вместе с семьёй.',
    "Qo'ng'iroq qilish": 'Позвонить',
    'American Fast Food. Barcha huquqlar himoyalangan.': 'American Fast Food. Все права защищены.',

    // --- privacy.html ---
    'Maxfiylik siyosati — American Fast Food': 'Политика конфиденциальности — American Fast Food',
    "American Fast Food saytida buyurtma berishda qanday ma'lumotlar yig'iladi va ular qanday ishlatiladi.":
      'Какие данные собирает сайт American Fast Food при оформлении заказа и как они используются.',
    'Bosh sahifa': 'Главная',
    'Oxirgi yangilanish: 2026-yil 29-oktabr': 'Последнее обновление: 29 октября 2026 г.',
    "Qanday ma'lumot yig'iladi": 'Какие данные мы собираем',
    'Saytda buyurtma berganingizda quyidagilarni yuborasiz:': 'Когда вы оформляете заказ на сайте, вы отправляете:',
    'ismingiz;': 'ваше имя;',
    'telefon raqamingiz;': 'номер телефона;',
    'manzil yoki izoh;': 'адрес или комментарий;',
    'tanlangan taomlar, ularning soni va umumiy summa;': 'выбранные блюда, их количество и общую сумму;',
    'rozilik belgisi va buyurtma vaqti.': 'отметку о согласии и время заказа.',
    'Spamdan himoyalanish uchun IP manzilingiz bir necha daqiqa davomida faqat server xotirasida tekshiriladi va bazaga yozilmaydi.':
      'Для защиты от спама ваш IP-адрес несколько минут проверяется только в памяти сервера и не записывается в базу.',
    'Nima uchun': 'Зачем',
    "Ma'lumotlaringiz faqat buyurtmangizni qabul qilish, tayyorlash, yetkazib berish va kerak bo'lsa siz bilan bog'lanish uchun ishlatiladi. Biz ularni sotmaymiz, reklama uchun ishlatmaymiz va uchinchi shaxslarga bermaymiz.":
      'Ваши данные используются только для того, чтобы принять, приготовить и доставить заказ и при необходимости связаться с вами. Мы их не продаём, не используем для рекламы и не передаём третьим лицам.',
    "Buyurtma xodimlarimizning Telegram chatiga yuboriladi va himoyalangan ma'lumotlar bazasida (Supabase) saqlanadi. Bazaga faqat kafe ma'muriyati kira oladi.":
      'Заказ отправляется в Telegram-чат наших сотрудников и хранится в защищённой базе данных (Supabase). Доступ к базе есть только у администрации кафе.',
    'Yandex Metrika': 'Яндекс Метрика',
    "Saytni qulayroq qilish uchun Yandex Metrika xizmatidan foydalanamiz. U anonim statistika yig'adi: qaysi sahifalar ochilgani, saytda qancha vaqt o'tkazilgani, qurilma va brauzer turi, taxminiy shahar. Buning uchun brauzeringizda cookie fayllari saqlanadi.":
      'Чтобы сделать сайт удобнее, мы используем сервис Яндекс Метрика. Он собирает анонимную статистику: какие страницы открывались, сколько времени провели на сайте, тип устройства и браузера, примерный город. Для этого в вашем браузере сохраняются файлы cookie.',
    "Vebvizor sahifadagi harakatlarni (bosish, aylantirish) yozib oladi, lekin buyurtma va joy band qilish formalaridagi ism, telefon va izoh maydonlariga yozilgan matnni yozmaydi. Metrikaga faqat buyurtma berilgani va uning summasi yuboriladi — ismingiz va telefon raqamingiz yuborilmaydi.":
      'Вебвизор записывает действия на странице (клики, прокрутку), но не записывает текст, который вы вводите в поля имени, телефона и комментария в формах заказа и бронирования. В Метрику передаётся только факт заказа и его сумма — ваше имя и номер телефона не передаются.',
    'Qancha saqlanadi': 'Сколько хранятся данные',
    "Buyurtma ma'lumotlari 12 oy saqlanadi, so'ng o'chiriladi. Bu muddat buyurtma bo'yicha savollar va shikoyatlarni hal qilish uchun kerak.":
      'Данные заказа хранятся 12 месяцев, затем удаляются. Этот срок нужен, чтобы решать вопросы и жалобы по заказам.',
    "O'chirishni qanday so'rash mumkin": 'Как запросить удаление данных',
    "Ma'lumotlaringizni ko'rish yoki o'chirishni xohlasangiz, biz bilan bog'laning:":
      'Если вы хотите посмотреть или удалить свои данные, свяжитесь с нами:',
    'telefon:': 'телефон:',
    "Buyurtmada ko'rsatgan ism va telefon raqamingizni ayting. So'rovingizni 30 kun ichida bajaramiz.":
      'Назовите имя и номер телефона, которые вы указали в заказе. Мы выполним запрос в течение 30 дней.',
  },

  // Tarjima qilinmaydigan matnlar (tekshiruv ularni «tarjimasi yo'q» demaydi).
  ozgarmas: [
    'AMERICAN',
    'FAST FOOD',
    'UZ',
    'RU',
    'Instagram',
    'Instagram:',
    '@american_caffetteria',
    'Coca-Cola',
    'Fanta',
    '© 2026 American Fast Food',
  ],

  // Sahifadagi aniq almashtirishlar (har biri sahifada aynan bir marta uchrashi kerak).
  sahifa: {
    index: [
      ['<html lang="uz">', '<html lang="ru">'],
      ['<link rel="canonical" href="https://burgersmash.uz/">', '<link rel="canonical" href="https://burgersmash.uz/ru">'],
      ['<meta property="og:url" content="https://burgersmash.uz/">', '<meta property="og:url" content="https://burgersmash.uz/ru">'],
      [
        '<meta property="og:locale" content="uz_UZ">\n<meta property="og:locale:alternate" content="ru_RU">',
        '<meta property="og:locale" content="ru_RU">\n<meta property="og:locale:alternate" content="uz_UZ">',
      ],
      ['data-til="uz" aria-current="page">UZ</a>', 'data-til="uz">UZ</a>'],
      ['data-til="ru">RU</a>', 'data-til="ru" aria-current="page">RU</a>'],
      ['<a href="privacy.html" target="_blank" class="gold-text">', '<a href="/ru/privacy" target="_blank" class="gold-text">'],
      ['<a href="privacy.html" class="gold-text">', '<a href="/ru/privacy" class="gold-text">'],
      ['<h3>Siz uchun <span class="gold-text">hamma narsa</span></h3>', '<h3>Всё <span class="gold-text">для вас</span></h3>'],
      [
        '<h3>Stolingizni <span class="gold-text">oldindan</span> band qiling</h3>',
        '<h3>Забронируйте <span class="gold-text">столик</span> заранее</h3>',
      ],
      // Mobil pastki panelda qisqaroq matn (bir qatorga sig'ishi uchun)
      [
        '<div class="mobile-bar">\n  <a href="#band-qilish" class="btn btn-gold">Joy band qiling</a>',
        '<div class="mobile-bar">\n  <a href="#band-qilish" class="btn btn-gold">Забронировать</a>',
      ],
    ],
    privacy: [
      ['<html lang="uz">', '<html lang="ru">'],
      ['<link rel="canonical" href="https://burgersmash.uz/privacy.html">', '<link rel="canonical" href="https://burgersmash.uz/ru/privacy">'],
      ['<meta property="og:url" content="https://burgersmash.uz/privacy.html">', '<meta property="og:url" content="https://burgersmash.uz/ru/privacy">'],
      [
        '<meta property="og:locale" content="uz_UZ">\n<meta property="og:locale:alternate" content="ru_RU">',
        '<meta property="og:locale" content="ru_RU">\n<meta property="og:locale:alternate" content="uz_UZ">',
      ],
      ['<a href="index.html" class="brand gold-text">', '<a href="/ru" class="brand gold-text">'],
      ['<a href="index.html" class="back">', '<a href="/ru" class="back">'],
      ['data-til="uz" aria-current="page">UZ</a>', 'data-til="uz">UZ</a>'],
      ['data-til="ru">RU</a>', 'data-til="ru" aria-current="page">RU</a>'],
      [
        `<p>Cookie fayllarini brauzer sozlamalarida o'chirib qo'yishingiz yoki <a href="https://yandex.ru/support/metrica/general/opt-out.html" target="_blank" rel="noopener">Yandex'ning rasmiy qo'shimchasi</a> bilan statistikadan voz kechishingiz mumkin.</p>`,
        '<p>Вы можете отключить cookie в настройках браузера или отказаться от сбора статистики с помощью <a href="https://yandex.ru/support/metrica/general/opt-out.html" target="_blank" rel="noopener">официального расширения Яндекса</a>.</p>',
      ],
    ],
  },

  // index.html dagi <script id="matnlar"> ning ruscha nusxasi (kalitlar bir xil bo'lishi kerak).
  // Massiv — ruscha ko'plik shakllari: 1 блюдо, 2 блюда, 5 блюд.
  js: {
    som: 'сум',
    savatga: 'В корзину',
    qoshildi: 'Добавлено ✓',
    tugadi: 'Закончилось',
    belgi: { XIT: 'ХИТ', HIT: 'ХИТ', FIRMA: 'ФИРМЕННОЕ', OILAVIY: 'ДЛЯ СЕМЬИ' },
    taomSoni: ['{n} блюдо', '{n} блюда', '{n} блюд'],
    stol: '🪑 Стол {n}',
    kamaytirish: 'Уменьшить количество: {nomi}',
    oshirish: 'Увеличить количество: {nomi}',
    tgYopish: 'Закрыть окно Telegram',
    xatoMaydon: 'Пожалуйста, правильно укажите имя, номер телефона и адрес или комментарий.',
    xatoRozilik: 'Чтобы оформить заказ, отметьте согласие на использование ваших данных.',
    xatoKutish: 'Вы только что оформили заказ. Попробуйте снова через {s} сек.',
    yuborilmadi: 'Заказ не отправлен',
    xatoKodi: 'код ошибки',
    yuborilmoqda: 'Отправляем...',
    yuborish: 'Отправить',
    bandMatn: 'Ваша заявка принята: {sana} в {vaqt}, {mehmon}. Чтобы подтвердить бронь, позвоните нам.',
  },

  // order.js javoblari (ruscha sahifadan kelgan buyurtmada). Telegram xabari o'zbekcha qoladi.
  server: {
    "So'rov rad etildi": 'Запрос отклонён',
    "Juda ko'p so'rov. Birozdan keyin urinib ko'ring": 'Слишком много запросов. Попробуйте чуть позже',
    "Ismni to'g'ri kiriting": 'Укажите имя правильно',
    "Telefon raqamini to'g'ri kiriting": 'Укажите номер телефона правильно',
    "Manzil yoki izoh 3 dan 300 belgigacha bo'lishi kerak": 'Адрес или комментарий — от 3 до 300 символов',
    "Ma'lumotlardan foydalanishga rozilik berilmagan": 'Нет согласия на использование данных',
    "Stol raqami noto'g'ri": 'Неверный номер стола',
    "Savat bo'sh": 'Корзина пуста',
    '«{nomi}» tugagan. Uni savatdan olib tashlang': '«{nomi}» закончилось. Уберите его из корзины',
    "Savatda noto'g'ri taom bor": 'В корзине есть недоступное блюдо',
    'Buyurtma yuborilmadi': 'Заказ не отправлен',
  },
};
