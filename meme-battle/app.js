/* Мем-баттл — вечериночная игра на одном устройстве.
   Порядок: подпись → передача телефона → голосование → итоги. */
(function () {
  'use strict';

  const SLOT_MAX = 64;
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 8;
  const AVATARS = ['🦊', '🐸', '🐙', '🦄', '🐼', '🐧', '🐝', '🦖'];
  const BOT_AVATAR = '🤖';
  const BOT_NAMES = [
    'Нейро-Мемолог',
    'Бот-Сценарист',
    'ИИ-Юморист',
    'ГПТ-Шутник',
    'Алгоритм Смеха',
    'Мем-Машина'
  ];

  const app = document.getElementById('app');

  const state = {
    run: 0,
    setup: [],
    rounds: 3,
    players: [],
    round: 0,
    templates: [],
    template: null,
    memes: [],
    writeQueue: [],
    writeIndex: 0,
    voters: [],
    voterIndex: 0,
    voted: new Set(),
    displayOrder: [],
    selected: null,
    usedLines: new Map()
  };

  /* ---------- утилиты ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function pickTemplates(count) {
    const photos = navigator.onLine === false ? [] : window.TEMPLATES.filter(function (item) { return item.image; });
    const source = photos.length >= count ? photos : window.TEMPLATES;
    return shuffle(source).slice(0, count);
  }

  function playerById(id) {
    return state.players.find(function (p) { return p.id === id; });
  }

  function plural(count, forms) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
  }

  function pointsLabel(count) {
    return count + ' ' + plural(count, ['очко', 'очка', 'очков']);
  }

  let toastTimer = null;
  function toast(message) {
    let node = document.querySelector('.toast');
    if (!node) {
      node = el('div', 'toast');
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      document.body.append(node);
    }
    node.textContent = message;
    node.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('is-visible'); }, 1800);
  }

  function setScreen(node) {
    app.replaceChildren(node);
    window.scrollTo(0, 0);
    const title = node.querySelector('.screen__title');
    if (title) {
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
    }
  }

  /* ---------- карточка мема ---------- */

  function fitCaption(node, text) {
    node.classList.toggle('is-long', text.length > 30 && text.length <= 52);
    node.classList.toggle('is-tiny', text.length > 52);
  }

  function buildPhotoCard(template, captions) {
    const figure = el('figure', 'meme meme--photo');
    figure.dataset.template = template.id;
    figure.style.setProperty('--c1', template.colors[0]);
    figure.style.setProperty('--c2', template.colors[1]);

    const photo = el('div', 'meme__photo');
    photo.dataset.emoji = template.emoji || '🖼️';

    const image = document.createElement('img');
    image.src = template.image;
    image.alt = template.title || '';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', function () {
      photo.classList.add('is-fallback');
      image.remove();
    });
    photo.append(image);

    (template.slots || []).forEach(function (slot, index) {
      const position = slot.position || (index === 0 && template.slots.length > 1 ? 'top' : 'bottom');
      const node = el('span', 'meme__photo-text is-' + position);
      const text = captions && captions[index] ? String(captions[index]) : '';
      if (text) {
        node.textContent = text;
        fitCaption(node, text);
      } else {
        node.classList.add('is-empty');
      }
      photo.append(node);
    });

    figure.append(photo);
    return figure;
  }

  function buildMemeCard(template, captions) {
    if (template.image) return buildPhotoCard(template, captions);

    const figure = el('figure', 'meme');
    figure.dataset.template = template.id;
    figure.style.setProperty('--c1', template.colors[0]);
    figure.style.setProperty('--c2', template.colors[1]);

    const grid = el('div', 'meme__grid meme__grid--' + template.layout);
    template.panels.forEach(function (panel, index) {
      const cell = el('div', 'meme__panel');
      cell.append(el('span', 'meme__emoji', panel.emoji));
      const caption = el('span', 'meme__caption');
      const text = captions && captions[index] ? String(captions[index]) : '';
      if (text) {
        caption.textContent = text;
        fitCaption(caption, text);
      } else {
        caption.classList.add('is-empty');
        caption.textContent = '···';
      }
      cell.append(caption);
      grid.append(cell);
    });

    figure.append(grid);
    return figure;
  }

  function gamebar(player, action) {
    const bar = el('header', 'gamebar');
    bar.append(el(
      'span',
      'gamebar__round',
      'Раунд ' + (state.round + 1) + ' из ' + state.rounds + ' · мем «' + state.template.title + '»'
    ));
    if (player) {
      const who = el('span', 'gamebar__who');
      who.append(el('span', 'gamebar__avatar', player.avatar));
      who.append(el('span', 'gamebar__name', player.name));
      if (action) who.append(el('span', 'gamebar__action', action));
      bar.append(who);
    }
    return bar;
  }

  /* ---------- стартовый экран ---------- */

  function defaultSetup() {
    return [1, 2, 3].map(function (n) { return { name: 'Игрок ' + n, isBot: false }; });
  }

  function nextBotName() {
    const taken = state.setup.map(function (p) { return p.name; });
    const free = BOT_NAMES.find(function (name) { return taken.indexOf(name) === -1; });
    if (free) return free;
    return 'Бот ' + (state.setup.filter(function (p) { return p.isBot; }).length + 1);
  }

  function renderStart() {
    state.run += 1;
    if (!state.setup.length) state.setup = defaultSetup();

    const screen = el('section', 'screen screen--start');

    const top = el('div', 'start-top');
    const hero = el('div', 'hero');
    hero.append(el('p', 'kicker', 'вечеринка на одном телефоне'));

    const title = el('h1', 'hero__title screen__title');
    title.append('МЕМ', el('span', 'hero__dot', '·'), 'БАТТЛ');
    hero.append(title);
    hero.append(el(
      'p',
      'hero__lead',
      'Придумай подпись к мему, передай телефон соседу и победи в голосовании. Или сразись с нейро-мемологами.'
    ));

    const steps = el('ol', 'steps');
    [
      ['Пишешь подпись', 'к мему раунда, в тайне от остальных'],
      ['Передаёшь телефон', 'следующему игроку'],
      ['Голосуете', 'за самый смешной мем, за свой нельзя']
    ].forEach(function (item, index) {
      const li = el('li', 'step');
      li.append(el('span', 'step__num', String(index + 1)));
      const body = el('div', 'step__body');
      body.append(el('strong', 'step__title', item[0]), el('span', 'step__text', item[1]));
      li.append(body);
      steps.append(li);
    });
    hero.append(steps);
    top.append(hero);

    const sample = el('div', 'sample');
    sample.append(el('span', 'sample__tag', 'так это выглядит'));
    sample.append(buildMemeCard(window.TEMPLATES[0], ['Пойти спать в 23:00', 'Смотреть рилсы до 3:00']));
    top.append(sample);
    screen.append(top);

    const playersPanel = el('section', 'panel');
    const playersHead = el('div', 'panel__head');
    playersHead.append(el('h2', 'panel__title', 'Кто играет'), el('span', 'panel__note', '3–8 участников'));
    playersPanel.append(playersHead);

    const list = el('ul', 'players');
    playersPanel.append(list);

    const addButton = el('button', 'btn btn--ghost add-player', '+ добавить игрока');
    addButton.type = 'button';
    playersPanel.append(addButton);

    const error = el('p', 'form-error');
    error.hidden = true;
    error.setAttribute('role', 'alert');
    playersPanel.append(error);

    function refreshRows() {
      list.replaceChildren();
      state.setup.forEach(function (player, index) {
        const row = el('li', 'player-row' + (player.isBot ? ' is-bot' : ''));

        const avatar = el('span', 'player-row__avatar', player.isBot ? BOT_AVATAR : AVATARS[index % AVATARS.length]);

        const input = el('input', 'player-row__name');
        input.type = 'text';
        input.maxLength = 18;
        input.value = player.name;
        input.setAttribute('aria-label', 'Имя участника ' + (index + 1));
        input.addEventListener('input', function () { player.name = input.value; });

        const botToggle = el('button', 'chip-toggle', player.isBot ? 'бот' : 'человек');
        botToggle.type = 'button';
        botToggle.setAttribute('aria-pressed', String(player.isBot));
        botToggle.title = player.isBot ? 'Сделать живым игроком' : 'Сделать ботом';
        botToggle.addEventListener('click', function () {
          player.isBot = !player.isBot;
          if (player.isBot && /^Игрок \d+$/.test(player.name.trim())) {
            player.name = nextBotName();
          } else if (!player.isBot && BOT_NAMES.indexOf(player.name) !== -1) {
            player.name = 'Игрок ' + (index + 1);
          }
          refreshRows();
        });

        const remove = el('button', 'player-row__remove', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Убрать участника ' + (index + 1));
        remove.disabled = state.setup.length <= MIN_PLAYERS;
        remove.addEventListener('click', function () {
          if (state.setup.length <= MIN_PLAYERS) return;
          state.setup.splice(index, 1);
          refreshRows();
        });

        row.append(avatar, input, botToggle, remove);
        list.append(row);
      });
      addButton.disabled = state.setup.length >= MAX_PLAYERS;
    }

    addButton.addEventListener('click', function () {
      if (state.setup.length >= MAX_PLAYERS) return;
      state.setup.push({ name: 'Игрок ' + (state.setup.length + 1), isBot: false });
      refreshRows();
    });

    refreshRows();
    screen.append(playersPanel);

    const roundsPanel = el('section', 'panel');
    const roundsHead = el('div', 'panel__head');
    roundsHead.append(el('h2', 'panel__title', 'Сколько раундов'), el('span', 'panel__note', 'каждый — новый мем'));
    roundsPanel.append(roundsHead);

    const segmented = el('div', 'segmented');
    segmented.setAttribute('role', 'group');
    segmented.setAttribute('aria-label', 'Количество раундов');
    [1, 2, 3, 4, 5].forEach(function (count) {
      const button = el('button', 'segmented__btn', String(count));
      button.type = 'button';
      button.setAttribute('aria-pressed', String(state.rounds === count));
      button.addEventListener('click', function () {
        state.rounds = count;
        Array.prototype.forEach.call(segmented.children, function (child) {
          child.setAttribute('aria-pressed', String(child === button));
        });
      });
      segmented.append(button);
    });
    roundsPanel.append(segmented);
    roundsPanel.append(el(
      'p',
      'panel__hint',
      'Вас двое? Добавьте бота: он сочиняет подписи сам и голосует наравне со всеми.'
    ));
    screen.append(roundsPanel);

    const startButton = el('button', 'btn btn--big start-btn', 'Начать баттл →');
    startButton.type = 'button';
    startButton.addEventListener('click', function () {
      const players = state.setup.map(function (player, index) {
        const name = player.name.trim() || 'Игрок ' + (index + 1);
        return {
          id: 'p' + index,
          name: name,
          isBot: player.isBot,
          avatar: player.isBot ? BOT_AVATAR : AVATARS[index % AVATARS.length],
          score: 0
        };
      });

      if (players.length < MIN_PLAYERS) {
        error.hidden = false;
        error.textContent = 'Нужно хотя бы три участника — иначе голосование закончится ничьей.';
        return;
      }
      if (!players.some(function (p) { return !p.isBot; })) {
        error.hidden = false;
        error.textContent = 'Все боты? Нужен хотя бы один живой игрок.';
        return;
      }

      error.hidden = true;
      state.run += 1;
      state.players = players;
      state.templates = pickTemplates(state.rounds);
      state.round = 0;
      state.usedLines = new Map();
      startRound();
    });
    screen.append(startButton);

    const foot = el('p', 'foot');
    foot.append('Играют на одном устройстве, прогресс не сохраняется. ');
    const online = el('a', 'foot__link', 'играть онлайн');
    online.href = 'index.html';
    const back = el('a', 'foot__link', '← все проекты');
    back.href = '../index.html';
    foot.append(online, ' · ', back);
    screen.append(foot);

    setScreen(screen);
  }

  /* ---------- игровой раунд ---------- */

  function startRound() {
    state.template = state.templates[state.round];
    state.memes = state.players.map(function (player, index) {
      return {
        id: 'm' + index,
        playerId: player.id,
        captions: new Array(state.template.slots.length).fill(''),
        votes: []
      };
    });
    state.writeQueue = state.players.slice();
    state.writeIndex = 0;
    state.usedLines.set(state.template.id, new Set());
    beginWriteTurn();
  }

  function memeFor(playerId) {
    return state.memes.find(function (meme) { return meme.playerId === playerId; });
  }

  function beginWriteTurn() {
    if (state.writeIndex >= state.writeQueue.length) {
      startVoting();
      return;
    }
    const player = state.writeQueue[state.writeIndex];
    if (player.isBot) {
      showBotWriting(player);
      const run = state.run;
      setTimeout(function () {
        if (run !== state.run) return;
        fillBotCaptions(player);
        finishWriteTurn();
      }, 1100 + Math.random() * 600);
      return;
    }
    showPassScreen(player);
  }

  function finishWriteTurn() {
    state.writeIndex += 1;
    beginWriteTurn();
  }

  function fillBotCaptions(player) {
    const template = state.template;
    const meme = memeFor(player.id);
    if (!meme) return;
    const used = state.usedLines.get(template.id) || new Set();
    let index = -1;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = Math.floor(Math.random() * template.botLines.length);
      if (!used.has(candidate)) {
        index = candidate;
        break;
      }
    }
    if (index === -1) index = Math.floor(Math.random() * template.botLines.length);
    used.add(index);
    state.usedLines.set(template.id, used);
    meme.captions = template.botLines[index].slice();
  }

  function showPassScreen(player) {
    const screen = el('section', 'screen screen--pass');
    screen.append(gamebar(null));

    const box = el('div', 'pass');
    box.append(el('span', 'pass__avatar', player.avatar));
    box.append(el('p', 'kicker', 'телефон у'));
    box.append(el('h1', 'pass__name screen__title', player.name));
    box.append(el('p', 'pass__hint', 'Остальные, отвернитесь: подпись увидит только автор.'));

    const go = el('button', 'btn btn--big', 'Это я — писать');
    go.type = 'button';
    go.addEventListener('click', function () { showWriteScreen(player); });
    box.append(go);

    screen.append(box);
    setScreen(screen);
  }

  function showBotWriting(player) {
    const screen = el('section', 'screen screen--bots');
    screen.append(gamebar(player, 'сочиняет'));

    const box = el('div', 'bots');
    box.append(el('span', 'pass__avatar', BOT_AVATAR));
    box.append(el('p', 'kicker', 'нейро-мемолог за работой'));
    box.append(el('h1', 'bots__title screen__title', player.name + ' придумывает шутку'));
    box.append(el('p', 'bots__hint', 'У ботов нет чувства юмора, но есть заготовки.'));

    const typing = el('div', 'typing');
    typing.append(el('span'), el('span'), el('span'));
    box.append(typing);

    screen.append(box);
    setScreen(screen);
  }

  function showWriteScreen(player) {
    const template = state.template;
    const meme = memeFor(player.id);
    if (!meme) return;

    const screen = el('section', 'screen screen--write');
    screen.append(gamebar(player, 'пишет'));

    const layout = el('div', 'write');

    const preview = el('div', 'write__preview');
    const card = buildMemeCard(template, meme.captions);
    preview.append(card);
    layout.append(preview);

    const form = el('form', 'write__form');
    form.noValidate = true;
    form.append(el('h1', 'write__title screen__title', 'Подпиши мем'));
    form.append(el('p', 'write__hint', template.tip));

    const captionNodes = card.querySelectorAll('.meme__caption, .meme__photo-text');
    const fields = [];

    template.slots.forEach(function (slot, index) {
      const field = el('label', 'field');
      const head = el('div', 'field__head');
      head.append(el('span', 'field__label', slot.label));
      const counter = el('span', 'field__count', '0/' + SLOT_MAX);
      head.append(counter);

      const input = el('input', 'field__input');
      input.type = 'text';
      input.maxLength = SLOT_MAX;
      input.value = meme.captions[index] || '';
      input.placeholder = slot.placeholder || '';
      input.autocomplete = 'off';
      input.spellcheck = false;

      field.append(head, input);
      form.append(field);
      fields.push({ input: input, counter: counter, index: index });
    });

    const submit = el('button', 'btn btn--big write__submit', 'Готово →');
    submit.type = 'submit';
    form.append(submit);

    function sync() {
      let filled = true;
      fields.forEach(function (field) {
        const value = field.input.value;
        if (!value.trim()) filled = false;
        field.counter.textContent = value.length + '/' + SLOT_MAX;
        field.counter.classList.toggle('is-full', value.length >= SLOT_MAX);
        const node = captionNodes[field.index];
        if (node) {
          const trimmed = value.trim();
          node.textContent = trimmed || '···';
          node.classList.toggle('is-empty', !trimmed);
          fitCaption(node, trimmed);
        }
      });
      submit.disabled = !filled;
    }

    fields.forEach(function (field) {
      field.input.addEventListener('input', sync);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (submit.disabled) return;
      meme.captions = fields.map(function (field) { return field.input.value.trim(); });
      finishWriteTurn();
    });

    sync();
    layout.append(form);
    screen.append(layout);
    setScreen(screen);

    if (fields[0]) fields[0].input.focus({ preventScroll: true });
  }

  /* ---------- голосование ---------- */

  function startVoting() {
    state.voters = state.players.filter(function (player) { return !player.isBot; });
    state.voterIndex = 0;
    state.voted = new Set();
    state.displayOrder = shuffle(state.memes.map(function (meme) { return meme.id; }));
    state.selected = null;
    beginVote();
  }

  function beginVote() {
    if (state.voterIndex >= state.voters.length) {
      finishVoting();
      return;
    }
    renderVoteScreen(state.voters[state.voterIndex]);
  }

  function renderVoteScreen(voter) {
    const screen = el('section', 'screen screen--vote');
    screen.append(gamebar(voter, 'голосует'));

    const head = el('div', 'vote__head');
    head.append(el('h1', 'vote__title screen__title', 'Кто смешнее?'));
    head.append(el('p', 'vote__hint', 'Выбери один мем. За свой голосовать нельзя, авторы скрыты до конца раунда.'));

    const body = el('div', 'vote-body');
    body.append(head);

    const progress = el('ul', 'voters');
    progress.setAttribute('aria-label', 'Кто уже проголосовал');
    state.voters.forEach(function (player) {
      const done = state.voted.has(player.id);
      const current = player.id === voter.id;
      const item = el('li', 'voter' + (done ? ' is-done' : '') + (current ? ' is-current' : ''));
      item.append(el('span', 'voter__avatar', player.avatar));
      item.append(el('span', 'voter__name', player.name));
      if (done) item.append(el('span', 'voter__mark', '✓'));
      else if (current) item.append(el('span', 'voter__mark', 'выбирает'));
      progress.append(item);
    });
    body.append(progress);

    const grid = el('div', 'vote-grid');

    const confirm = el('button', 'btn btn--big vote__confirm', 'Сначала выбери мем');
    confirm.type = 'button';
    confirm.disabled = true;

    state.displayOrder.forEach(function (memeId, index) {
      const meme = state.memes.find(function (item) { return item.id === memeId; });
      const own = meme.playerId === voter.id;

      const card = el('button', 'vote-card' + (own ? ' is-own' : ''));
      card.type = 'button';
      card.disabled = own;
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', 'Мем номер ' + (index + 1) + (own ? ', твой' : ''));

      const number = el('span', 'vote-card__num', '#' + (index + 1));
      card.append(number);
      card.append(buildMemeCard(state.template, meme.captions));
      if (own) card.append(el('span', 'vote-card__tag', 'твой мем'));

      card.addEventListener('click', function () {
        if (own) return;
        state.selected = memeId;
        Array.prototype.forEach.call(grid.children, function (child) {
          const active = child === card;
          child.classList.toggle('is-selected', active);
          child.setAttribute('aria-pressed', String(active));
        });
        confirm.disabled = false;
        confirm.textContent = 'Отдать голос за #' + (index + 1);
      });

      grid.append(card);
    });

    body.append(grid);

    const actions = el('div', 'vote__actions');
    actions.append(confirm);
    body.append(actions);
    screen.append(body);

    confirm.addEventListener('click', function () {
      if (!state.selected) return;
      submitVote(voter, state.selected);
    });

    setScreen(screen);
  }

  function submitVote(voter, memeId) {
    const meme = state.memes.find(function (item) { return item.id === memeId; });
    if (!meme || meme.playerId === voter.id) return;
    meme.votes.push(voter.id);
    state.voted.add(voter.id);
    state.voterIndex += 1;
    state.selected = null;
    beginVote();
  }

  function pickBotVote(bot) {
    const options = state.memes.filter(function (meme) { return meme.playerId !== bot.id; });
    if (!options.length) return null;
    return options[Math.floor(Math.random() * options.length)];
  }

  async function finishVoting() {
    const run = state.run;
    const bots = state.players.filter(function (player) { return player.isBot; });

    if (!bots.length) {
      revealRound();
      return;
    }

    const screen = el('section', 'screen screen--bots');
    screen.append(gamebar(null));

    const box = el('div', 'bots');
    box.append(el('h1', 'bots__title screen__title', 'Нейро-мемологи голосуют'));
    box.append(el('p', 'bots__hint', 'Они не видели ваши подписи, но у них есть мнение.'));

    const list = el('ul', 'bots__list');
    const marks = new Map();
    bots.forEach(function (bot) {
      const item = el('li', 'bots__item');
      item.append(el('span', 'bots__avatar', BOT_AVATAR), el('span', 'bots__name', bot.name));
      const mark = el('span', 'bots__mark', 'думает…');
      marks.set(bot.id, mark);
      item.append(mark);
      list.append(item);
    });
    box.append(list);
    screen.append(box);
    setScreen(screen);

    for (let i = 0; i < bots.length; i += 1) {
      await sleep(420 + Math.random() * 320);
      if (run !== state.run) return;
      const choice = pickBotVote(bots[i]);
      if (choice) choice.votes.push(bots[i].id);
      const mark = marks.get(bots[i].id);
      if (mark) {
        mark.textContent = '✓ проголосовал';
        mark.classList.add('is-done');
      }
    }

    await sleep(500);
    if (run !== state.run) return;
    revealRound();
  }

  /* ---------- итоги ---------- */

  function roundScore(meme) {
    return meme.votes.length;
  }

  function votesLabel(meme) {
    const count = meme.votes.length;
    if (!count) return 'никто не проголосовал';
    const names = meme.votes.map(function (id) {
      const player = playerById(id);
      return player ? player.name : '?';
    });
    return names.join(', ');
  }

  function renderScoreboard(container, delta) {
    const sorted = state.players.slice().sort(function (a, b) { return b.score - a.score; });
    sorted.forEach(function (player, index) {
      const row = el('li', 'score' + (index === 0 ? ' is-top' : ''));
      row.append(el('span', 'score__place', String(index + 1)));
      row.append(el('span', 'score__avatar', player.avatar));
      row.append(el('span', 'score__name', player.name));
      if (delta) {
        const gained = delta.get(player.id) || 0;
        row.append(el('span', 'score__delta' + (gained ? ' is-plus' : ''), gained ? '+' + gained : '0'));
      }
      row.append(el('span', 'score__points', String(player.score)));
      container.append(row);
    });
  }

  function revealRound() {
    const template = state.template;
    const delta = new Map();
    state.players.forEach(function (player) { delta.set(player.id, 0); });
    state.memes.forEach(function (meme) { delta.set(meme.playerId, meme.votes.length); });
    state.players.forEach(function (player) { player.score += delta.get(player.id) || 0; });

    const ranked = state.memes.slice().sort(function (a, b) {
      const diff = b.votes.length - a.votes.length;
      if (diff !== 0) return diff;
      return state.displayOrder.indexOf(a.id) - state.displayOrder.indexOf(b.id);
    });
    const best = ranked.length ? ranked[0].votes.length : 0;

    const screen = el('section', 'screen screen--reveal');
    screen.append(gamebar(null));
    screen.append(el('h1', 'reveal__title screen__title', 'Итоги раунда ' + (state.round + 1)));
    screen.append(el(
      'p',
      'reveal__hint',
      best ? 'Один голос — одно очко. Вот как распределились симпатии.' : 'Голоса кончились, легенды остались.'
    ));

    const results = el('ol', 'results');
    ranked.forEach(function (meme, index) {
      const player = playerById(meme.playerId);
      const isTop = best > 0 && meme.votes.length === best;
      const item = el('li', 'result' + (isTop ? ' is-winner' : ''));

      const cardWrap = el('div', 'result__card');
      cardWrap.append(buildMemeCard(template, meme.captions));
      item.append(cardWrap);

      const info = el('div', 'result__info');
      const author = el('div', 'result__author');
      author.append(el('span', 'result__avatar', player ? player.avatar : '?'));
      author.append(el('span', 'result__name', player ? player.name : '?'));
      if (isTop) author.append(el('span', 'result__badge', 'лучший мем раунда'));
      info.append(author);
      info.append(el('p', 'result__votes', votesLabel(meme)));
      info.append(el('p', 'result__points', (meme.votes.length ? '+' : '') + pointsLabel(meme.votes.length)));
      item.append(info);

      results.append(item);
    });
    screen.append(results);

    screen.append(el('h2', 'section-title', 'Счёт'));
    const scoreboard = el('ol', 'scores');
    renderScoreboard(scoreboard, delta);
    screen.append(scoreboard);

    const isLast = state.round + 1 >= state.rounds;
    const next = el('button', 'btn btn--big', isLast ? 'К финалу →' : 'Следующий раунд →');
    next.type = 'button';
    next.addEventListener('click', function () {
      if (isLast) {
        renderFinal();
      } else {
        state.round += 1;
        startRound();
      }
    });
    screen.append(next);

    setScreen(screen);
  }

  function renderFinal() {
    state.run += 1;
    const sorted = state.players.slice().sort(function (a, b) { return b.score - a.score; });
    const best = sorted.length ? sorted[0].score : 0;
    const winners = sorted.filter(function (player) { return player.score === best; });
    const medals = ['🥇', '🥈', '🥉'];

    const screen = el('section', 'screen screen--final');
    const hero = el('div', 'final__hero');
    hero.append(el('span', 'final__crown', winners.length > 1 ? '🤝' : '🏆'));
    hero.append(el('p', 'kicker', winners.length > 1 ? 'ничья, оба хороши' : 'победитель баттла'));
    hero.append(el('h1', 'final__name screen__title', winners.map(function (p) { return p.name; }).join(' и ')));
    hero.append(el('p', 'final__score', pointsLabel(best)));
    screen.append(hero);

    const table = el('ol', 'scores scores--final');
    let place = 0;
    sorted.forEach(function (player, index) {
      if (index === 0 || player.score !== sorted[index - 1].score) place = index + 1;
      const row = el('li', 'score' + (place === 1 ? ' is-top' : ''));
      const medal = place <= 3 && player.score > 0 ? medals[place - 1] : String(place);
      row.append(el('span', 'score__place', medal));
      row.append(el('span', 'score__avatar', player.avatar));
      row.append(el('span', 'score__name', player.name));
      row.append(el('span', 'score__points', String(player.score)));
      table.append(row);
    });
    screen.append(table);

    const actions = el('div', 'final__actions');
    const again = el('button', 'btn btn--big', 'Ещё раз →');
    again.type = 'button';
    again.addEventListener('click', function () {
      state.run += 1;
      state.players.forEach(function (player) { player.score = 0; });
      state.templates = pickTemplates(state.rounds);
      state.round = 0;
      state.usedLines = new Map();
      startRound();
    });

    const restart = el('button', 'btn btn--ghost', 'Новая компания');
    restart.type = 'button';
    restart.addEventListener('click', function () { renderStart(); });

    actions.append(again, restart);
    screen.append(actions);

    const share = el('button', 'share', 'Скопировать результат');
    share.type = 'button';
    share.addEventListener('click', function () {
      const text = 'Мем-баттл: ' + winners.map(function (p) { return p.name + ' — ' + p.score; }).join(', ') + ' очк.';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          toast('Результат скопирован');
        }).catch(function () {
          toast('Не получилось скопировать');
        });
      } else {
        toast('Буфер обмена недоступен');
      }
    });
    screen.append(share);

    setScreen(screen);
    launchConfetti();
  }

  /* ---------- конфетти ---------- */

  function launchConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = el('canvas', 'confetti');
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    document.body.append(canvas);

    const context = canvas.getContext('2d');
    const ratio = window.devicePixelRatio;
    const colors = ['#d8ff3e', '#ff5fa2', '#8b5cf6', '#22d3ee', '#fff6d8'];
    const pieces = Array.from({ length: 140 }, function () {
      return {
        x: Math.random() * window.innerWidth * ratio,
        y: -Math.random() * window.innerHeight * ratio * 0.4,
        w: (6 + Math.random() * 8) * ratio,
        h: (8 + Math.random() * 10) * ratio,
        vy: (2 + Math.random() * 3.4) * ratio,
        vx: (-1.4 + Math.random() * 2.8) * ratio,
        angle: Math.random() * Math.PI,
        spin: (-0.12 + Math.random() * 0.24),
        color: colors[Math.floor(Math.random() * colors.length)]
      };
    });

    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      context.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(function (piece) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.03 * ratio;
        piece.angle += piece.spin;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.fillStyle = piece.color;
        context.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        context.restore();
      });

      if (elapsed < 3200) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    }

    requestAnimationFrame(frame);
  }

  /* ---------- запуск ---------- */

  renderStart();
})();
