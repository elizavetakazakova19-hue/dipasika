/* Шаблоны мемов: панели, подписи и заготовки реплик для ботов.
   botLines — по одной реплике на каждую подпись шаблона. */
const BOT_PAIRS = [
  ['Ожидание', 'Реальность'],
  ['План', 'Факт'],
  ['До кофе', 'После кофе'],
  ['Понедельник', 'Пятница'],
  ['Я', 'Мой код'],
  ['Начальник', 'Задача'],
  ['Обещал', 'Сделал'],
  ['Хотел', 'Получилось'],
  ['В теории', 'На практике'],
  ['Утро', 'Вечер']
];

const BOT_SINGLE = [
  ['Когда всё пошло не по плану'],
  ['Я после планёрки'],
  ['Мой план на день'],
  ['Когда сказали «быстро»'],
  ['Я и дедлайн'],
  ['Это нормально'],
  ['Всё под контролем'],
  ['Так и задумано'],
  ['Я не виноват'],
  ['Мне всё равно']
];

window.TEMPLATES = [
  {
    id: 'drake',
    title: 'Дрейк',
    layout: 'column',
    colors: ['#6d5efc', '#ff5fa2'],
    tip: 'Верхняя панель — что отвергаем, нижняя — что выбираем.',
    panels: [{ emoji: '🙅‍♂️' }, { emoji: '😎' }],
    slots: [
      { label: 'Что отвергаем', placeholder: 'например: встать в 7 утра' },
      { label: 'Что выбираем', placeholder: 'например: встать в 7 вечера' }
    ],
    botLines: [
      ['Встать в 7 утра', 'Встать в 7 вечера'],
      ['Сделать отчёт заранее', 'Сделать отчёт за час до сдачи'],
      ['Пить воду', 'Четвёртый кофе до обеда'],
      ['Читать документацию', 'Спросить у нейросети'],
      ['Написать тесты', 'Написать «работает же»'],
      ['Позвонить маме', 'Посмотреть 40 рилсов про котов']
    ]
  },
  {
    id: 'spiderman',
    title: 'Два Спайдермена',
    layout: 'row',
    colors: ['#ff5f6d', '#3b6bff'],
    tip: 'Два одинаковых мема указывают друг на друга.',
    panels: [{ emoji: '🕷️' }, { emoji: '🕷️' }],
    slots: [
      { label: 'Первый Спайдермен', placeholder: 'его аргумент' },
      { label: 'Второй Спайдермен', placeholder: 'и его аргумент' }
    ],
    botLines: [
      ['Это баг', 'Это фича'],
      ['Ты не понимаешь', 'Ты не понимаешь, но я тоже'],
      ['Надо срочно', 'Можно после обеда'],
      ['Гениальная идея', 'Та же идея, но моя'],
      ['Ты виноват', 'Ты виноват, но давай не будем'],
      ['Мой код чистый', 'Мой код тоже']
    ]
  },
  {
    id: 'catwoman',
    title: 'Кот и хозяйка',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/6908411ee6fbbe9949a97d63567d41bc.jpg',
    emoji: '😾',
    colors: ['#ffb347', '#ff5f6d'],
    tip: 'Кот оправдывается, хозяйка кричит.',
    slots: [
      { label: 'Кот оправдывается', placeholder: 'что говорит кот', position: 'bottom' },
      { label: 'Хозяйка кричит', placeholder: 'что кричит хозяйка', position: 'top' }
    ],
    botLines: [
      ['Я не трогал цветок', 'Ты сожрал цветок'],
      ['Я всё объясню', 'Ты снова уронил прод'],
      ['Это не я', 'На камере ты'],
      ['Мне нужно личное пространство', 'Ты сидишь в моей кружке'],
      ['Я на диете', 'Ты съел мой корм'],
      ['Я просто рядом посижу', 'Ты уже час на клавиатуре']
    ]
  },
  {
    id: 'thisisfine',
    title: 'Всё нормально',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/fcceb45254a43bb9707d8ac84fa6c816.jpg',
    emoji: '🐶',
    colors: ['#ff7b00', '#b91c1c'],
    tip: 'Всё горит, но «это нормально».',
    slots: [
      { label: 'Что горит', placeholder: 'что происходит', position: 'top' },
      { label: 'Собака говорит', placeholder: '«всё нормально»', position: 'bottom' }
    ],
    botLines: [
      ['Дедлайн завтра', 'Всё под контролем'],
      ['Сервер упал', 'Это плановые работы'],
      ['Бюджет кончился', 'Всё по плану'],
      ['Продукт горит', 'Всё нормально'],
      ['Отпуск отменили', 'Зато командный дух'],
      ['Тимлид уволился', 'Отличная возможность для роста']
    ]
  },
  {
    id: 'galaxybrain',
    title: 'Галактический мозг',
    layout: 'column',
    colors: ['#7b2ff7', '#16d1ff'],
    tip: 'Обычное решение против гениального.',
    panels: [{ emoji: '🧠' }, { emoji: '🌌' }],
    slots: [
      { label: 'Маленький мозг', placeholder: 'обычное решение' },
      { label: 'Галактический мозг', placeholder: 'гениальное решение' }
    ],
    botLines: [
      ['Прочитать ТЗ', 'Написать код и надеяться'],
      ['Задать вопрос', 'Спросить у нейросети'],
      ['Починить баг', 'Обновить страницу'],
      ['Учиться пять лет', 'Посмотреть туториал на 15 минут'],
      ['Сделать по-хорошему', 'Сделать через костыль'],
      ['Думать головой', 'Думать галактикой']
    ]
  },
  {
    id: 'stonks',
    title: 'Стонкс',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/6a5cb05cc89ed49090000fd51859afcf.jpg',
    emoji: '📈',
    colors: ['#0ea5e9', '#22c55e'],
    tip: 'Подпись к графику, который всегда растёт.',
    slots: [{ label: 'Подпись к мему', placeholder: 'например: прибыль растёт', position: 'bottom' }],
    botLines: [
      ['STONKS'],
      ['Купил акции на все деньги'],
      ['Прибыль растёт, объяснять не надо'],
      ['Инвестиции — это просто'],
      ['Я финансовый гений']
    ]
  },
  {
    id: 'cryingcat',
    title: 'Плачущий кот',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/94b6be10fd5238b7c9a0dfa4b9a89b45.jpg',
    emoji: '😿',
    colors: ['#6b7280', '#3b82f6'],
    tip: 'Что пишет кот в сообщении.',
    slots: [{ label: 'Сообщение кота', placeholder: 'например: ты не отвечаешь', position: 'bottom' }],
    botLines: [
      ['Ты не отвечаешь четыре минуты'],
      ['Я так и знал'],
      ['Мне сказали, ты прочитал и не ответил'],
      ['Пишу первым, потому что люблю'],
      ['У тебя новый мем, а у меня слёзы']
    ]
  },
  {
    id: 'leo',
    title: 'Смеющийся Лео',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/755b06672cf17661288eb0fff834a4ce.jpg',
    emoji: '🍷',
    colors: ['#f59e0b', '#ef4444'],
    tip: 'Над чем смеётся человек с бокалом.',
    slots: [{ label: 'Над чем смеётся', placeholder: 'например: мой план на день', position: 'bottom' }],
    botLines: [
      ['Мой план на день'],
      ['Слово «быстро» в задачах'],
      ['Собеседование прошло отлично'],
      ['Я и дедлайн'],
      ['Коллега сказал «на пять минут»']
    ]
  },
  {
    id: 'chad',
    title: 'Гигачад',
    layout: 'single',
    colors: ['#64748b', '#0f172a'],
    tip: 'Что говорит каменное лицо.',
    panels: [{ emoji: '🗿' }],
    slots: [{ label: 'Реплика Гигачада', placeholder: 'например: мне всё равно' }],
    botLines: [
      ['Мне всё равно'],
      ['Я не читаю ТЗ, я их чувствую'],
      ['Говорю «да» и не делаю'],
      ['Сон — для слабых'],
      ['Мой единственный баг — перфекционизм']
    ]
  },
  {
    id: 'panic',
    title: 'Паника',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/c6e05e03c70c4ce3b8eb45b9ab26fa12.jpg',
    emoji: '🏃',
    colors: ['#22d3ee', '#a855f7'],
    tip: 'Спокойствие и паника на одном меме.',
    slots: [
      { label: 'Спокойный', placeholder: '«всё успею»', position: 'top' },
      { label: 'Паника', placeholder: '«дедлайн вчера»', position: 'bottom' }
    ],
    botLines: [
      ['Задача на 10 минут', 'Задача на 10 минут, прошло 3 часа'],
      ['Всё успею', 'Дедлайн был вчера'],
      ['Я спокоен', 'Я СПОКОЕН!!!'],
      ['Сейчас разберусь', 'Уже ничего не понимаю'],
      ['План есть', 'План был']
    ]
  },
  {
    id: 'evolution',
    title: 'Эволюция',
    layout: 'row',
    colors: ['#84cc16', '#0ea5e9'],
    tip: 'От обезьяны до офиса.',
    panels: [{ emoji: '🐒' }, { emoji: '🧑‍💼' }],
    slots: [
      { label: 'Обезьяна', placeholder: 'что делает обезьяна' },
      { label: 'Человек', placeholder: 'что делает человек' }
    ],
    botLines: [
      ['Съесть банан', 'Заполнить таймшит'],
      ['Жить в пещере', 'Арендовать офис в центре'],
      ['Кинуть палку', 'Кинуть задачу на другого'],
      ['Быть обезьяной', 'Быть менеджером'],
      ['Эволюция', 'Планёрка на час']
    ]
  },
  {
    id: 'sharikov',
    title: 'Шариков',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/2d36e76effb7356349edde43265194c3.jpg',
    emoji: '🐕',
    colors: ['#8b5e3c', '#2b2118'],
    tip: 'Что говорит Шариков.',
    slots: [
      { label: 'Реплика Шарикова', placeholder: 'например: взять всё и поделить', position: 'bottom' }
    ],
    botLines: [
      ['Взять всё и поделить'],
      ['Я не хуже других'],
      ['Документ у меня есть'],
      ['Мы с вами ещё поговорим'],
      ['Я — Шариков, я всё могу']
    ]
  },
  {
    id: 'pool',
    title: 'Пловец и скелет',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/7c65675c38e4611fda7bf29b869b81ad.jpg',
    emoji: '🌊',
    colors: ['#0ea5e9', '#0b3b5a'],
    tip: 'Сверху — как держишься, снизу — что под водой.',
    slots: [
      { label: 'На поверхности', placeholder: 'как дела на самом деле', position: 'top' },
      { label: 'Под водой', placeholder: 'что скрыто', position: 'bottom' }
    ],
    botLines: [
      ['Отпуск на море', 'Третий день отпуска'],
      ['Держусь на плаву', 'Уже давно не держусь'],
      ['Всё под контролем', 'Скелет уже на дне'],
      ['Плыву к цели', 'Течение несёт обратно'],
      ['Я справляюсь', 'Скелет сомневается']
    ]
  },
  {
    id: 'button',
    title: 'Две кнопки',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/1a33e4f0151d80b80e32ee57ee694b4f.jpg',
    emoji: '🔴',
    colors: ['#ef4444', '#1e293b'],
    tip: 'Верхняя кнопка и нижняя — что выберешь.',
    slots: [
      { label: 'Верхняя кнопка', placeholder: 'первый вариант', position: 'top' },
      { label: 'Нижняя кнопка', placeholder: 'второй вариант', position: 'bottom' }
    ],
    botLines: [
      ['Нажать сейчас', 'Нажать потом'],
      ['Сделать самому', 'Позвать на помощь'],
      ['Ответить сразу', 'Прочитать и забыть'],
      ['Согласиться', 'Отложить на завтра'],
      ['Нажать красную', 'Нажать синюю']
    ]
  },
  {
    id: 'nagiev',
    title: 'Нагиев с бумажкой',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/6f4d78a039eeb2d2676aa48a3d542e65.jpg',
    emoji: '📄',
    colors: ['#1f2937', '#f59e0b'],
    tip: 'Что написано на бумажке.',
    slots: [
      { label: 'Что на бумажке', placeholder: 'например: премия согласована', position: 'center' }
    ],
    botLines: [
      ['Всё согласовано'],
      ['Премия одобрена'],
      ['Отпуск подписан'],
      ['Так написано в ТЗ'],
      ['Это официально'],
      ['Проверено юристами']
    ]
  },
  {
    id: 'schwarzenegger',
    title: 'Шварценеггер',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/02f186c797fcc1db6ef89ef0f58bea2d.jpg',
    emoji: '💪',
    colors: ['#3f3f46', '#111827'],
    tip: 'Суровый взгляд и две подписи.',
    slots: [
      { label: 'Верхняя подпись', position: 'top' },
      { label: 'Нижняя подпись', position: 'bottom' }
    ],
    botLines: BOT_PAIRS
  },
  {
    id: 'scientist',
    title: 'Учёный',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/aec62dc38b283b25fbdd913e48201733.jpg',
    emoji: '👨‍🔬',
    colors: ['#065f46', '#22c55e'],
    tip: 'Я и сам своего рода учёный.',
    slots: [
      { label: 'Верхняя подпись', position: 'top' },
      { label: 'Нижняя подпись', position: 'bottom' }
    ],
    botLines: BOT_PAIRS
  },
  {
    id: 'mustache',
    title: 'Суровый мужик',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/a6707d167cde785e43d979c46e7eb829.jpg',
    emoji: '🥸',
    colors: ['#78350f', '#f59e0b'],
    tip: 'Одна подпись — как приговор.',
    slots: [{ label: 'Подпись', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'thinker',
    title: 'Рисовач',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/a237c7dfc28cdd45a66eafabe4c27732.jpg',
    emoji: '🤔',
    colors: ['#312e81', '#8b5cf6'],
    tip: 'О чём человек задумался.',
    slots: [{ label: 'Мысль', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'dogtoy',
    title: 'Пёс и игрушка',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/f07c2ed5853d46658762db170834501f.jpg',
    emoji: '🐶',
    colors: ['#9a3412', '#f97316'],
    tip: 'Что происходит у собаки.',
    slots: [{ label: 'Подпись', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'cinema',
    title: 'Смеющийся в кино',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/2c6434d7053344e7c4c6506d5fa70f14.jpg',
    emoji: '😂',
    colors: ['#7f1d1d', '#ef4444'],
    tip: 'Над чем смеётся зал.',
    slots: [{ label: 'Над чем смеётся', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'cats',
    title: 'Коты за столом',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/4d51a39d155323a991c743bc76af8048.jpg',
    emoji: '🐱',
    colors: ['#0f766e', '#14b8a6'],
    tip: 'Что обсуждают коты.',
    slots: [{ label: 'Реплика кота', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'handshake',
    title: 'Рукопожатие',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/6b20a059aaf6f935e6305f87de8d2578.jpg',
    emoji: '🤝',
    colors: ['#1e3a8a', '#3b82f6'],
    tip: 'Договорились? Договорились.',
    slots: [
      { label: 'Первый участник', position: 'top' },
      { label: 'Второй участник', position: 'bottom' }
    ],
    botLines: BOT_PAIRS
  },
  {
    id: 'bleat',
    title: 'Блеат',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/5cd48e936d32b96fa61178fe617b7533.jpg',
    emoji: '😬',
    colors: ['#334155', '#94a3b8'],
    tip: 'Когда не сдержался.',
    slots: [{ label: 'Реплика', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'walken',
    title: 'Уокен',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/e0e08b43bea14015468b14edb32e34cb.jpg',
    emoji: '🕴️',
    colors: ['#422006', '#a16207'],
    tip: 'Что говорит человек с лицом Уокена.',
    slots: [{ label: 'Реплика', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'fring',
    title: 'Гус Фринг',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/095dd709eb6bf646ab996526ad94a0b2.jpg',
    emoji: '🍗',
    colors: ['#365314', '#84cc16'],
    tip: 'Спокойствие, только спокойствие.',
    slots: [{ label: 'Реплика Гуса', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'ronaldo',
    title: 'Роналду',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/7e7b30bfcc0d1c78e68f6f12b13c41e8.jpg',
    emoji: '⚽',
    colors: ['#14532d', '#22c55e'],
    tip: 'Что написано на бумажке.',
    slots: [{ label: 'Надпись на бумажке', position: 'center' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'volturi',
    title: 'Вольтури',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/30e059f0b736ab2c72caf617060765d7.jpg',
    emoji: '⚔️',
    colors: ['#450a0a', '#b91c1c'],
    tip: 'Совет собрался, вопросы есть.',
    slots: [
      { label: 'Первый', position: 'top' },
      { label: 'Второй', position: 'bottom' }
    ],
    botLines: BOT_PAIRS
  },
  {
    id: 'bed',
    title: 'Пара в постели',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/add901e2ef4e71418c687785722d7abd.jpg',
    emoji: '🛏️',
    colors: ['#1e40af', '#60a5fa'],
    tip: 'О чём он думает.',
    slots: [{ label: 'Мысль', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'toystory',
    title: 'Базз и Вуди',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/ef065132ef2532c41d95fab7ec82ff77.jpg',
    emoji: '🤠',
    colors: ['#4c1d95', '#a855f7'],
    tip: 'Два взгляда на одну ситуацию.',
    slots: [
      { label: 'Базз', position: 'top' },
      { label: 'Вуди', position: 'bottom' }
    ],
    botLines: BOT_PAIRS
  },
  {
    id: 'confucius',
    title: 'Конфуций',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/3d0534819fb938ee3cf5dbe1b3467493.jpg',
    emoji: '🧘',
    colors: ['#44403c', '#a8a29e'],
    tip: 'Мудрость дня.',
    slots: [{ label: 'Мудрость', position: 'bottom' }],
    botLines: BOT_SINGLE
  },
  {
    id: 'laptop',
    title: 'Ноутбук и молоток',
    layout: 'photo',
    image: 'https://images.meme-arsenal.com/e6d6ee3434f7e5131474528b2e2bc9b2.jpg',
    emoji: '💻',
    colors: ['#0f172a', '#3b82f6'],
    tip: 'Когда техника не слушается.',
    slots: [{ label: 'Подпись', position: 'bottom' }],
    botLines: BOT_SINGLE
  }
];
