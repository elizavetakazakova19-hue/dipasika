/* Мем-баттл онлайн: комнаты на PeerJS, хост — авторитет, гости — тонкие клиенты. */
(function () {
  'use strict';

  const SLOT_MAX = 64;
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 8;
  const AVATARS = ['🦊', '🐸', '🐙', '🦄', '🐼', '🐧', '🐝', '🦖'];
  const BOT_AVATAR = '🤖';
  const BOT_NAMES = ['Нейро-Мемолог', 'Бот-Сценарист', 'ИИ-Юморист', 'ГПТ-Шутник', 'Алгоритм Смеха', 'Мем-Машина'];
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PEER_PREFIX = 'membattle-';
  const NAME_KEY = 'membattle:name';
  const SESSION_PREFIX = 'membattle:session:';
  const PEER_CDN = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';

  const app = document.getElementById('app');

  const S = {
    isHost: false,
    code: '',
    me: null,
    peer: null,
    hostConn: null,
    room: null,
    snapshot: null,
    viewKey: '',
    connecting: false,
    leaving: false,
    confettiKey: ''
  };

  /* ---------- утилиты ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function btn(label, className, onClick) {
    const node = el('button', 'btn ' + (className || ''), label);
    node.type = 'button';
    if (onClick) node.addEventListener('click', onClick);
    return node;
  }

  function setScreen(node) {
    app.replaceChildren(node);
    window.scrollTo(0, 0);
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

  function cleanName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  }

  function randomCode() {
    let code = '';
    for (let i = 0; i < 4; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  function templateById(id) {
    return window.TEMPLATES.find(function (item) { return item.id === id; }) || window.TEMPLATES[0];
  }

  function playerById(snapshot, id) {
    return snapshot.players.find(function (player) { return player.id === id; });
  }

  function isDone(snapshot, key, id) {
    return (snapshot[key] || []).indexOf(id) !== -1;
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
    toastTimer = setTimeout(function () { node.classList.remove('is-visible'); }, 2200);
  }

  function copyText(text, success) {
    function fallback() {
      const area = el('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      try {
        document.execCommand('copy');
        toast(success);
      } catch (error) {
        toast('Не получилось скопировать');
      }
      area.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(success); }).catch(fallback);
    } else {
      fallback();
    }
  }

  function shareUrl() {
    const url = new URL(location.href);
    url.searchParams.set('room', S.code);
    url.hash = '';
    return url.href;
  }

  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (S.peerLoading) return S.peerLoading;
    S.peerLoading = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = PEER_CDN;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('PeerJS не загрузился')); };
      document.head.append(script);
    });
    return S.peerLoading;
  }

  function destroyPeer() {
    if (S.peer) {
      try { S.peer.destroy(); } catch (error) {}
      S.peer = null;
    }
    S.hostConn = null;
  }

  /* ---------- карточка мема ---------- */

  function fitCaption(node, text) {
    node.classList.toggle('is-long', text.length > 30 && text.length <= 52);
    node.classList.toggle('is-tiny', text.length > 52);
  }

  function buildMemeCard(template, captions) {
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

  /* ---------- общие части экранов ---------- */

  function gamebar(snapshot, action) {
    const bar = el('header', 'gamebar');
    const round = el('span', 'gamebar__round');
    round.textContent = 'Раунд ' + (snapshot.round + 1) + ' из ' + snapshot.rounds +
      (snapshot.templateId ? ' · мем «' + templateById(snapshot.templateId).title + '»' : '');
    bar.append(round);

    const who = el('span', 'gamebar__who');
    who.append(el('span', 'gamebar__avatar', snapshot.you.avatar || '🙂'));
    who.append(el('span', 'gamebar__name', snapshot.you.name));
    if (action) who.append(el('span', 'gamebar__action', action));

    const right = el('div', 'gamebar__right');
    right.append(who);
    if (snapshot.code) right.append(el('span', 'code-chip', snapshot.code));
    bar.append(right);
    return bar;
  }

  function fillPeople(node, snapshot, doneKey, hideId) {
    node.replaceChildren();
    snapshot.players.forEach(function (player) {
      if (hideId && player.id === hideId) return;
      const done = isDone(snapshot, doneKey, player.id);
      const person = el('span', 'waiting__person' + (done ? ' is-done' : ''));
      person.append(el('span', 'waiting__avatar', player.avatar || '🙂'));
      person.append(el('span', null, player.name));
      const mark = done ? '✓' : (player.connected ? '…' : 'вышел');
      person.append(el('span', 'waiting__mark', mark));
      node.append(person);
    });
  }

  function rosterList(snapshot) {
    const list = el('ul', 'roster');
    snapshot.players.forEach(function (player) {
      const row = el('li', 'roster__row' + (player.id === snapshot.you.id ? ' is-you' : '') + (player.connected ? '' : ' is-off'));
      row.append(el('span', 'roster__avatar', player.avatar || '🙂'));
      row.append(el('span', 'roster__name', player.name));
      if (player.isHost) row.append(el('span', 'roster__tag is-host', 'хост'));
      if (player.isBot) row.append(el('span', 'roster__tag is-bot', 'бот'));
      if (player.id === snapshot.you.id) row.append(el('span', 'roster__tag', 'вы'));
      if (!player.connected) row.append(el('span', 'roster__tag is-off', 'вышел'));
      if (S.isHost && player.isBot) {
        const remove = el('button', 'roster__remove', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', 'Убрать ' + player.name);
        remove.addEventListener('click', function () { removeBot(player.id); });
        row.append(remove);
      }
      list.append(row);
    });
    return list;
  }

  function votesText(snapshot, meme) {
    if (!meme.votes.length) return 'никто не проголосовал';
    return meme.votes.map(function (id) {
      const player = playerById(snapshot, id);
      return player ? player.name : '?';
    }).join(', ');
  }

  function scoresList(snapshot, delta) {
    const players = snapshot.players.slice().sort(function (a, b) { return b.score - a.score; });
    const list = el('ol', 'scores');
    players.forEach(function (player, index) {
      const row = el('li', 'score' + (index === 0 && player.score > 0 ? ' is-top' : ''));
      row.append(el('span', 'score__place', String(index + 1)));
      row.append(el('span', 'score__avatar', player.avatar || '🙂'));
      row.append(el('span', 'score__name', player.name));
      if (delta) {
        const gained = delta[player.id] || 0;
        row.append(el('span', 'score__delta' + (gained ? ' is-plus' : ''), gained ? '+' + gained : '0'));
      }
      row.append(el('span', 'score__points', String(player.score)));
      list.append(row);
    });
    return list;
  }

  /* ---------- лендинг ---------- */

  function renderLanding(message) {
    S.viewKey = 'landing';
    S.connecting = false;

    const savedName = localStorage.getItem(NAME_KEY) || '';
    const params = new URLSearchParams(location.search);
    const roomParam = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

    const screen = el('section', 'screen screen--landing');
    const landing = el('div', 'landing');

    const intro = el('div', 'landing__intro');
    intro.append(el('p', 'kicker', 'онлайн-комната для друзей'));
    const title = el('h1', 'hero__title screen__title');
    title.append('МЕМ', el('span', 'hero__dot', '·'), 'БАТТЛ');
    intro.append(title);
    intro.append(el(
      'p',
      'hero__lead',
      'Создайте комнату и отправьте друзьям ссылку — каждый играет со своего телефона. Подписи, голосование и очки синхронизируются сами.'
    ));

    const steps = el('ol', 'steps');
    [
      ['Создаёте комнату', 'получаете короткий код из четырёх символов'],
      ['Зовёте друзей', 'они открывают ссылку и вводят имя'],
      ['Играете', 'каждый пишет и голосует со своего устройства']
    ].forEach(function (item, index) {
      const li = el('li', 'step');
      li.append(el('span', 'step__num', String(index + 1)));
      const body = el('div', 'step__body');
      body.append(el('strong', 'step__title', item[0]), el('span', 'step__text', item[1]));
      li.append(body);
      steps.append(li);
    });
    intro.append(steps);

    const links = el('p', 'landing__links');
    links.append('Хотите на одном телефоне? ');
    const local = el('a', null, 'Локальная игра');
    local.href = 'local.html';
    links.append(local, '.');
    intro.append(links);
    landing.append(intro);

    const form = el('section', 'panel landing__form');

    const nameField = el('label', 'field');
    const nameHead = el('div', 'field__head');
    nameHead.append(el('span', 'field__label', 'Ваше имя'));
    nameField.append(nameHead);
    const nameInput = el('input', 'field__input');
    nameInput.type = 'text';
    nameInput.maxLength = 18;
    nameInput.autocomplete = 'nickname';
    nameInput.placeholder = 'например: Аня';
    nameInput.value = savedName;
    nameField.append(nameInput);
    form.append(nameField);

    const error = el('p', 'form-error');
    error.hidden = true;
    error.setAttribute('role', 'alert');

    function showError(text) {
      error.hidden = false;
      error.textContent = text;
    }

    function currentName() {
      const name = cleanName(nameInput.value);
      if (!name) {
        showError('Введите имя — его увидят другие игроки.');
        nameInput.focus();
        return null;
      }
      localStorage.setItem(NAME_KEY, name);
      return name;
    }

    const create = btn('Создать комнату', 'btn--big', function () {
      const name = currentName();
      if (!name) return;
      error.hidden = true;
      loadPeer().then(function () { startHosting(name); }).catch(function () {
        showError('Не загрузился сетевой модуль. Проверьте интернет и обновите страницу.');
      });
    });
    form.append(create);

    form.append(el('div', 'or', 'или войти по коду'));

    const codeField = el('label', 'field');
    const codeHead = el('div', 'field__head');
    codeHead.append(el('span', 'field__label', 'Код комнаты'));
    codeField.append(codeHead);
    const codeInput = el('input', 'field__input field__input--code');
    codeInput.type = 'text';
    codeInput.inputMode = 'text';
    codeInput.maxLength = 4;
    codeInput.placeholder = 'K7QF';
    codeInput.autocomplete = 'off';
    codeInput.spellcheck = false;
    codeInput.value = roomParam;
    codeInput.addEventListener('input', function () {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    });
    codeField.append(codeInput);
    form.append(codeField);

    const join = btn('Войти в комнату', 'btn--ghost', function () {
      const name = currentName();
      if (!name) return;
      const code = codeInput.value.toUpperCase();
      if (code.length !== 4) {
        showError('Код комнаты — четыре символа, например K7QF.');
        codeInput.focus();
        return;
      }
      error.hidden = true;
      loadPeer().then(function () { joinAsGuest(name, code); }).catch(function () {
        showError('Не загрузился сетевой модуль. Проверьте интернет и обновите страницу.');
      });
    });
    form.append(join);
    form.append(error);

    if (message) showError(message);

    landing.append(form);
    screen.append(landing);
    setScreen(screen);

    if (roomParam) codeInput.focus({ preventScroll: true });
    else nameInput.focus({ preventScroll: true });
  }

  function startHosting(name) {
    S.isHost = true;
    S.connecting = true;
    renderConnecting('Создаём комнату…');
    createRoomWithRetry(name, 5);
  }

  function createRoomWithRetry(name, attempts) {
    const code = randomCode();
    const peer = new window.Peer(PEER_PREFIX + code.toLowerCase(), { debug: 0 });
    S.peer = peer;
    let opened = false;

    peer.on('open', function () {
      if (opened) return;
      opened = true;
      S.code = code;
      S.connecting = false;
      S.room = createRoom(name);
      S.me = S.room.players[0];
      S.viewKey = '';
      renderHost();
    });

    peer.on('error', function (err) {
      if (opened) {
        toast('Соединение с сервером комнаты прервалось. Обновите страницу.');
        return;
      }
      if (err && err.type === 'unavailable-id' && attempts > 1) {
        try { peer.destroy(); } catch (error) {}
        createRoomWithRetry(name, attempts - 1);
        return;
      }
      failLanding('Не удалось создать комнату. Проверьте интернет и попробуйте ещё раз.');
    });

    peer.on('connection', function (conn) {
      conn.on('data', function (msg) { hostOnData(conn, msg); });
      conn.on('close', function () { hostOnClose(conn); });
      conn.on('error', function () { hostOnClose(conn); });
    });

    peer.on('disconnected', function () {
      try { peer.reconnect(); } catch (error) {}
    });
  }

  function createRoom(name) {
    return {
      phase: 'lobby',
      round: 0,
      rounds: 3,
      seq: 1,
      players: [{
        id: 'p1',
        name: cleanName(name) || 'Хост',
        isHost: true,
        isBot: false,
        score: 0,
        connected: true,
        avatar: AVATARS[0]
      }],
      memes: [],
      template: null,
      templates: [],
      submitted: new Set(),
      voted: new Set(),
      displayOrder: [],
      points: {},
      winners: [],
      botsUsed: new Set(),
      advancing: false
    };
  }

  function joinAsGuest(name, code, playerId) {
    S.isHost = false;
    S.code = code;
    S.connecting = true;
    S.leaving = false;
    renderConnecting('Подключаемся к комнате ' + code + '…');

    const peer = new window.Peer({ debug: 0 });
    S.peer = peer;
    let opened = false;

    peer.on('open', function () {
      const conn = peer.connect(PEER_PREFIX + code.toLowerCase(), { reliable: true, metadata: { name: name } });
      S.hostConn = conn;
      conn.on('open', function () {
        opened = true;
        conn.send({
          t: 'hello',
          name: name,
          playerId: playerId || localStorage.getItem(SESSION_PREFIX + code) || null
        });
      });
      conn.on('data', guestOnData);
      conn.on('close', guestOnClose);
      conn.on('error', guestOnClose);
    });

    peer.on('error', function (err) {
      if (opened) {
        toast('Соединение с комнатой прервалось.');
        return;
      }
      if (err && err.type === 'peer-unavailable') {
        failLanding('Комната ' + code + ' не найдена. Проверьте код — возможно, хост закрыл страницу.');
      } else {
        failLanding('Не удалось подключиться к комнате. Проверьте интернет.');
      }
    });

    peer.on('disconnected', function () {
      try { peer.reconnect(); } catch (error) {}
    });

    setTimeout(function () {
      if (S.connecting) {
        failLanding('Не удалось соединиться с комнатой. Проверьте, что хост держит вкладку открытой. Если сеть блокирует прямое соединение, попробуйте подключиться к той же Wi-Fi сети.');
      }
    }, 25000);
  }

  function guestOnData(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'state') {
      S.connecting = false;
      S.me = msg.state.you;
      S.code = msg.state.code;
      localStorage.setItem(SESSION_PREFIX + S.code, msg.state.you.id);
      const params = new URLSearchParams(location.search);
      params.set('room', S.code);
      try { history.replaceState(null, '', '?' + params.toString()); } catch (error) {}
      applySnapshot(msg.state);
      return;
    }
    if (msg.t === 'error') {
      if (S.connecting) failLanding(msg.message || 'Комната недоступна.');
      else toast(msg.message || 'Ошибка комнаты');
    }
  }

  function guestOnClose() {
    if (S.leaving || S.isHost) return;
    if (!S.room) return;
    if (S.connecting) {
      failLanding('Комната не отвечает. Попробуйте войти ещё раз.');
      return;
    }
    renderDisconnected('Связь с комнатой потеряна. Возможно, хост закрыл страницу.');
  }

  function failLanding(message) {
    destroyPeer();
    S.connecting = false;
    S.room = null;
    S.snapshot = null;
    S.isHost = false;
    S.code = '';
    renderLanding(message);
  }

  function renderConnecting(text) {
    const screen = el('section', 'screen screen--connecting');
    const box = el('div', 'connecting');
    box.append(el('h1', 'connecting__title screen__title', 'Подключаемся'));
    box.append(el('p', 'connecting__text', text));
    const typing = el('div', 'typing');
    typing.append(el('span'), el('span'), el('span'));
    box.append(typing);
    const cancel = btn('Отмена', 'btn btn--ghost connecting__cancel', function () {
      destroyPeer();
      S.connecting = false;
      renderLanding();
    });
    box.append(cancel);
    screen.append(box);
    setScreen(screen);
  }

  function renderDisconnected(message) {
    const screen = el('section', 'screen screen--disconnected');
    const box = el('div', 'waiting');
    box.append(el('span', 'waiting__icon', '🔌'));
    box.append(el('h1', 'waiting__title screen__title', 'Связь потеряна'));
    box.append(el('p', 'waiting__text', message));

    const actions = el('div', 'final__actions');
    const name = (S.me && S.me.name) || localStorage.getItem(NAME_KEY) || '';
    const code = S.code;
    if (code) {
      const reconnect = btn('Переподключиться', 'btn btn--big', function () {
        destroyPeer();
        joinAsGuest(name || 'Игрок', code);
      });
      actions.append(reconnect);
    }
    const home = btn('На главную', 'btn btn--ghost', function () {
      destroyPeer();
      S.code = '';
      renderLanding();
    });
    actions.append(home);
    box.append(actions);
    screen.append(box);
    setScreen(screen);
  }

  /* ---------- сообщения хоста ---------- */

  function sendState(conn, player) {
    try {
      conn.send({ t: 'state', state: snapshotFor(player) });
    } catch (error) {}
  }

  function sendError(conn, message) {
    try { conn.send({ t: 'error', message: message }); } catch (error) {}
    setTimeout(function () {
      try { conn.close(); } catch (error) {}
    }, 400);
  }

  function hostOnData(conn, msg) {
    const room = S.room;
    if (!room || !msg || typeof msg !== 'object') return;

    if (msg.t === 'hello') {
      let player = msg.playerId ? room.players.find(function (item) {
        return item.id === msg.playerId && !item.isBot && !item.isHost;
      }) : null;

      if (!player) {
        if (room.phase !== 'lobby') {
          sendError(conn, 'Игра уже началась. Дождитесь следующей или попросите новую комнату.');
          return;
        }
        if (room.players.length >= MAX_PLAYERS) {
          sendError(conn, 'Комната заполнена: максимум восемь игроков.');
          return;
        }
        player = {
          id: 'p' + (room.seq += 1),
          name: uniqueName(msg.name),
          isHost: false,
          isBot: false,
          score: 0,
          connected: true,
          avatar: AVATARS[room.players.length % AVATARS.length]
        };
        room.players.push(player);
      } else {
        player.connected = true;
      }

      conn.playerId = player.id;
      if (player.conn && player.conn !== conn) {
        try { player.conn.close(); } catch (error) {}
      }
      player.conn = conn;
      sendState(conn, player);
      pushState();
      return;
    }

    if (!conn.playerId) return;
    if (msg.t === 'caption') hostCaption(conn.playerId, msg.captions);
    else if (msg.t === 'vote') hostVote(conn.playerId, msg.memeId);
  }

  function hostOnClose(conn) {
    const room = S.room;
    if (!room) return;
    const player = room.players.find(function (item) { return item.conn === conn; });
    if (!player) return;
    player.connected = false;
    player.conn = null;
    pushState();
    maybeAdvanceWriting();
    maybeAdvanceVoting();
  }

  function uniqueName(base) {
    const room = S.room;
    const clean = cleanName(base) || 'Игрок';
    let name = clean;
    let index = 2;
    while (room.players.some(function (player) { return player.name.toLowerCase() === name.toLowerCase(); })) {
      name = clean + ' ' + index;
      index += 1;
    }
    return name;
  }

  function broadcast() {
    const room = S.room;
    if (!room) return;
    room.players.forEach(function (player) {
      if (player.isBot || !player.conn) return;
      sendState(player.conn, player);
    });
  }

  function snapshotFor(player) {
    const room = S.room;
    const snapshot = {
      phase: room.phase,
      code: S.code,
      round: room.round,
      rounds: room.rounds,
      templateId: room.template ? room.template.id : null,
      you: { id: player.id, name: player.name, avatar: player.avatar },
      hostId: (room.players.find(function (item) { return item.isHost; }) || {}).id,
      players: room.players.map(function (item) {
        return {
          id: item.id,
          name: item.name,
          score: item.score,
          isBot: item.isBot,
          connected: item.connected,
          isHost: item.isHost,
          avatar: item.avatar
        };
      }),
      submittedIds: Array.from(room.submitted),
      votedIds: Array.from(room.voted)
    };

    if (room.phase === 'writing') {
      const own = room.memes.find(function (meme) { return meme.playerId === player.id; });
      snapshot.yourMemeId = own ? own.id : null;
      snapshot.yourCaptions = own ? own.captions.slice() : [];
    }

    if (room.phase === 'voting' || room.phase === 'reveal') {
      snapshot.memes = room.memes.map(function (meme) {
        return {
          id: meme.id,
          captions: meme.captions.slice(),
          votes: room.phase === 'reveal' ? meme.votes.slice() : [],
          playerId: room.phase === 'reveal' ? meme.playerId : null
        };
      });
      snapshot.displayOrder = room.displayOrder.slice();
      const own = room.memes.find(function (meme) { return meme.playerId === player.id; });
      snapshot.yourMemeId = own ? own.id : null;
    }

    if (room.phase === 'reveal') snapshot.points = Object.assign({}, room.points);
    if (room.phase === 'final') snapshot.winners = room.winners.slice();
    return snapshot;
  }

  function pushState() {
    if (!S.isHost || !S.room) return;
    broadcast();
    renderHost();
  }

  function renderHost() {
    if (!S.room) return;
    const host = S.room.players.find(function (player) { return player.isHost; });
    if (!host) return;
    applySnapshot(snapshotFor(host));
  }

  /* ---------- ход игры на хосте ---------- */

  function hostCaption(playerId, captions) {
    const room = S.room;
    if (!room || room.phase !== 'writing' || !room.template) return;
    const meme = room.memes.find(function (item) { return item.playerId === playerId; });
    if (!meme) return;
    if (!Array.isArray(captions) || captions.length !== room.template.slots.length) return;
    const clean = captions.map(function (value) { return cleanCaption(value); });
    if (clean.some(function (value) { return !value; })) return;
    meme.captions = clean;
    room.submitted.add(playerId);
    pushState();
    maybeAdvanceWriting();
  }

  function cleanCaption(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, SLOT_MAX);
  }

  function hostVote(playerId, memeId) {
    const room = S.room;
    if (!room || room.phase !== 'voting') return;
    if (room.voted.has(playerId)) return;
    const meme = room.memes.find(function (item) { return item.id === memeId; });
    if (!meme || meme.playerId === playerId) return;
    meme.votes.push(playerId);
    room.voted.add(playerId);
    pushState();
    maybeAdvanceVoting();
  }

  function maybeAdvanceWriting() {
    const room = S.room;
    if (!room || room.phase !== 'writing' || room.advancing) return;
    const waiting = room.players.some(function (player) {
      return !player.isBot && player.connected && !room.submitted.has(player.id);
    });
    if (waiting) return;
    room.advancing = true;
    setTimeout(function () {
      if (!S.room || S.room !== room || room.phase !== 'writing') return;
      beginVoting();
    }, 650);
  }

  function beginVoting() {
    const room = S.room;
    room.phase = 'voting';
    room.advancing = false;
    room.memes = room.memes.filter(function (meme) { return room.submitted.has(meme.playerId); });
    room.displayOrder = shuffle(room.memes.map(function (meme) { return meme.id; }));
    room.voted = new Set();

    room.players.filter(function (player) { return player.isBot; }).forEach(function (bot) {
      const options = room.memes.filter(function (meme) { return meme.playerId !== bot.id; });
      if (!options.length) return;
      const choice = options[Math.floor(Math.random() * options.length)];
      choice.votes.push(bot.id);
      room.voted.add(bot.id);
    });

    pushState();
    maybeAdvanceVoting();
  }

  function maybeAdvanceVoting() {
    const room = S.room;
    if (!room || room.phase !== 'voting' || room.advancing) return;
    const waiting = room.players.some(function (player) {
      return !player.isBot && player.connected && !room.voted.has(player.id);
    });
    if (waiting) return;
    room.advancing = true;
    setTimeout(function () {
      if (!S.room || S.room !== room || room.phase !== 'voting') return;
      revealRound();
    }, 550);
  }

  function revealRound() {
    const room = S.room;
    room.phase = 'reveal';
    room.advancing = false;
    room.points = {};
    room.players.forEach(function (player) { room.points[player.id] = 0; });
    room.memes.forEach(function (meme) { room.points[meme.playerId] = meme.votes.length; });
    room.players.forEach(function (player) { player.score += room.points[player.id] || 0; });
    pushState();
  }

  function startGame() {
    const room = S.room;
    if (!room || !S.isHost || room.phase !== 'lobby') return;
    if (room.players.length < MIN_PLAYERS) {
      toast('Нужно хотя бы три участника: позовите друга или добавьте бота.');
      pushState();
      return;
    }
    room.players.forEach(function (player) { player.score = 0; });
    room.templates = shuffle(window.TEMPLATES).slice(0, room.rounds);
    room.round = 0;
    S.confettiKey = '';
    startRound();
  }

  function startRound() {
    const room = S.room;
    room.phase = 'writing';
    room.template = room.templates[room.round];
    room.memes = room.players.map(function (player, index) {
      return {
        id: 'm' + room.round + '_' + index,
        playerId: player.id,
        captions: new Array(room.template.slots.length).fill(''),
        votes: []
      };
    });
    room.submitted = new Set();
    room.voted = new Set();
    room.displayOrder = [];
    room.points = {};
    room.winners = [];
    room.advancing = false;
    room.botsUsed = new Set();
    fillBotCaptions();
    pushState();
    maybeAdvanceWriting();
  }

  function fillBotCaptions() {
    const room = S.room;
    room.players.filter(function (player) { return player.isBot; }).forEach(function (bot) {
      const meme = room.memes.find(function (item) { return item.playerId === bot.id; });
      if (!meme) return;
      const lines = room.template.botLines;
      let index = -1;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const candidate = Math.floor(Math.random() * lines.length);
        if (!room.botsUsed.has(candidate)) {
          index = candidate;
          break;
        }
      }
      if (index === -1) index = Math.floor(Math.random() * lines.length);
      room.botsUsed.add(index);
      meme.captions = lines[index].slice();
      room.submitted.add(bot.id);
    });
  }

  function nextRoundOrFinal() {
    const room = S.room;
    if (!room || room.phase !== 'reveal') return;
    if (room.round + 1 >= room.rounds) {
      room.phase = 'final';
      const best = Math.max.apply(null, room.players.map(function (player) { return player.score; }));
      room.winners = room.players.filter(function (player) { return player.score === best; }).map(function (player) { return player.id; });
      pushState();
      return;
    }
    room.round += 1;
    startRound();
  }

  function playAgain() {
    const room = S.room;
    if (!room || room.phase !== 'final') return;
    room.players.forEach(function (player) { player.score = 0; });
    if (room.players.length < MIN_PLAYERS) {
      room.phase = 'lobby';
      pushState();
      toast('Нужно три участника — добавьте бота или позовите друга.');
      return;
    }
    room.round = 0;
    room.templates = shuffle(window.TEMPLATES).slice(0, room.rounds);
    S.confettiKey = '';
    startRound();
  }

  function addBot() {
    const room = S.room;
    if (!room || !S.isHost || room.phase !== 'lobby' || room.players.length >= MAX_PLAYERS) return;
    let name = BOT_NAMES.find(function (candidate) {
      return !room.players.some(function (player) { return player.name === candidate; });
    });
    if (!name) name = 'Бот ' + (room.players.filter(function (player) { return player.isBot; }).length + 1);
    room.players.push({
      id: 'p' + (room.seq += 1),
      name: name,
      isHost: false,
      isBot: true,
      score: 0,
      connected: true,
      avatar: BOT_AVATAR
    });
    pushState();
  }

  function removeBot(id) {
    const room = S.room;
    if (!room || !S.isHost || room.phase !== 'lobby') return;
    room.players = room.players.filter(function (player) { return !(player.isBot && player.id === id); });
    pushState();
  }

  function setRounds(count) {
    const room = S.room;
    if (!room || !S.isHost || room.phase !== 'lobby') return;
    room.rounds = count;
    pushState();
  }

  function leaveRoom() {
    S.leaving = true;
    destroyPeer();
    S.room = null;
    S.snapshot = null;
    S.isHost = false;
    S.me = null;
    S.code = '';
    S.viewKey = '';
    S.leaving = false;
    try { history.replaceState(null, '', location.pathname); } catch (error) {}
    renderLanding();
  }

  /* ---------- отрисовка состояния ---------- */

  function viewKey(snapshot) {
    const roster = (snapshot.phase === 'lobby' || snapshot.phase === 'reveal' || snapshot.phase === 'final')
      ? snapshot.players.map(function (player) {
        return player.id + player.name + (player.connected ? '1' : '0') + (player.isBot ? '1' : '0');
      }).join(',')
      : '';
    return [
      snapshot.phase,
      snapshot.round,
      snapshot.rounds,
      snapshot.templateId,
      snapshot.yourMemeId,
      isDone(snapshot, 'submittedIds', snapshot.you.id) ? 'sub' : '',
      isDone(snapshot, 'votedIds', snapshot.you.id) ? 'voted' : '',
      roster
    ].join('|');
  }

  function applySnapshot(snapshot) {
    if (!snapshot) return;
    S.snapshot = snapshot;
    if (snapshot.phase !== 'final') S.confettiKey = '';
    const key = viewKey(snapshot);
    if (key === S.viewKey) {
      updateLive(snapshot);
      return;
    }
    S.viewKey = key;
    renderScreen(snapshot);
  }

  function updateLive(snapshot) {
    const waiting = document.querySelector('[data-waiting]');
    if (waiting) {
      const hide = waiting.dataset.hideSelf ? snapshot.you.id : null;
      fillPeople(waiting, snapshot, 'submittedIds', hide);
    }
    const voters = document.querySelector('[data-voters]');
    if (voters) {
      const hide = voters.dataset.hideSelf ? snapshot.you.id : null;
      fillPeople(voters, snapshot, 'votedIds', hide);
    }
  }

  function renderScreen(snapshot) {
    if (snapshot.phase === 'lobby') renderLobby(snapshot);
    else if (snapshot.phase === 'writing') {
      if (isDone(snapshot, 'submittedIds', snapshot.you.id)) renderWaitingWrite(snapshot);
      else renderWrite(snapshot);
    } else if (snapshot.phase === 'voting') {
      if (isDone(snapshot, 'votedIds', snapshot.you.id)) renderWaitingVote(snapshot);
      else renderVote(snapshot);
    } else if (snapshot.phase === 'reveal') renderReveal(snapshot);
    else if (snapshot.phase === 'final') renderFinal(snapshot);
  }

  function renderLobby(snapshot) {
    const screen = el('section', 'screen screen--lobby');
    const lobby = el('div', 'lobby');

    const room = el('div', 'room');
    room.append(el('p', 'kicker', 'комната'));
    const code = el('div', 'room__code', snapshot.code);
    code.title = 'Нажмите, чтобы скопировать код';
    code.addEventListener('click', function () { copyText(snapshot.code, 'Код скопирован'); });
    room.append(code);
    room.append(el(
      'p',
      'room__hint',
      S.isHost
        ? 'Отправьте друзьям код или ссылку — они подключатся сами.'
        : 'Позовите друзей: им нужен этот код или ссылка. Игра начнётся, когда хост нажмёт «Начать».'
    ));
    room.append(el('p', 'room__link', shareUrl()));

    const actions = el('div', 'room__actions');
    actions.append(btn('Скопировать ссылку', 'btn', function () {
      copyText(shareUrl(), 'Ссылка скопирована');
    }));
    actions.append(btn('Скопировать код', 'btn btn--ghost', function () {
      copyText(snapshot.code, 'Код скопирован');
    }));
    if (navigator.share) {
      actions.append(btn('Поделиться', 'btn btn--ghost', function () {
        navigator.share({
          title: 'Мем-баттл',
          text: 'Заходи в комнату ' + snapshot.code,
          url: shareUrl()
        }).catch(function () {});
      }));
    }
    room.append(actions);
    lobby.append(room);

    const grid = el('div', 'lobby-grid');

    const rosterPanel = el('section', 'panel');
    const head = el('div', 'panel__head');
    head.append(el('h2', 'panel__title', 'Игроки'), el('span', 'panel__note', snapshot.players.length + ' из ' + MAX_PLAYERS));
    rosterPanel.append(head);
    rosterPanel.append(rosterList(snapshot));

    if (S.isHost) {
      const add = btn('+ добавить бота', 'btn btn--ghost add-player', addBot);
      add.disabled = snapshot.players.length >= MAX_PLAYERS;
      rosterPanel.append(add);
    }
    grid.append(rosterPanel);

    const side = el('div', 'lobby-side');

    const roundsPanel = el('section', 'panel');
    const roundsHead = el('div', 'panel__head');
    roundsHead.append(
      el('h2', 'panel__title', 'Раунды'),
      el('span', 'panel__note', S.isHost ? 'каждый — новый мем' : 'решает хост')
    );
    roundsPanel.append(roundsHead);
    if (S.isHost) {
      const segmented = el('div', 'segmented');
      segmented.setAttribute('role', 'group');
      segmented.setAttribute('aria-label', 'Количество раундов');
      [1, 2, 3, 4, 5].forEach(function (count) {
        const option = el('button', 'segmented__btn', String(count));
        option.type = 'button';
        option.setAttribute('aria-pressed', String(snapshot.rounds === count));
        option.addEventListener('click', function () { setRounds(count); });
        segmented.append(option);
      });
      roundsPanel.append(segmented);
    } else {
      roundsPanel.append(el('p', 'status-line', 'В этой игре раундов: ' + snapshot.rounds + '.'));
    }
    side.append(roundsPanel);

    const actionPanel = el('section', 'panel');
    if (S.isHost) {
      const start = btn('Начать игру →', 'btn btn--big', startGame);
      start.disabled = snapshot.players.length < MIN_PLAYERS;
      actionPanel.append(start);
      actionPanel.append(el(
        'p',
        'status-line',
        snapshot.players.length < MIN_PLAYERS
          ? 'Нужно хотя бы три участника: позовите друга или добавьте бота.'
          : 'Все на месте. Можно начинать.'
      ));
    } else {
      actionPanel.append(el('h2', 'panel__title', 'Ждём хоста'));
      actionPanel.append(el('p', 'status-line', 'Игра начнётся, когда хост нажмёт «Начать игру».'));
    }
    side.append(actionPanel);

    side.append(btn(S.isHost ? 'Закрыть комнату' : 'Выйти из комнаты', 'btn btn--ghost', leaveRoom));
    grid.append(side);

    lobby.append(grid);
    screen.append(lobby);
    setScreen(screen);
  }

  function renderWrite(snapshot) {
    const template = templateById(snapshot.templateId);
    const screen = el('section', 'screen screen--write');
    screen.append(gamebar(snapshot, 'пишет'));

    const layout = el('div', 'write');
    const preview = el('div', 'write__preview');
    const card = buildMemeCard(template, snapshot.yourCaptions || []);
    preview.append(card);
    layout.append(preview);

    const form = el('form', 'write__form');
    form.noValidate = true;
    form.append(el('h1', 'write__title screen__title', 'Подпиши мем'));
    form.append(el('p', 'write__hint', template.tip));

    const captionNodes = card.querySelectorAll('.meme__caption');
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
      input.value = (snapshot.yourCaptions && snapshot.yourCaptions[index]) || '';
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

    const status = el('div', 'waiting__people');
    status.dataset.waiting = '';
    status.dataset.hideSelf = '1';
    form.append(status);
    fillPeople(status, snapshot, 'submittedIds', snapshot.you.id);

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

    fields.forEach(function (field) { field.input.addEventListener('input', sync); });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (submit.disabled) return;
      const captions = fields.map(function (field) { return field.input.value.trim(); });
      if (captions.some(function (value) { return !value; })) return;
      submit.disabled = true;
      submit.textContent = 'Отправляем…';
      if (S.isHost) {
        hostCaption(snapshot.you.id, captions);
      } else {
        sendToHost({ t: 'caption', captions: captions });
      }
    });

    sync();
    layout.append(form);
    screen.append(layout);
    setScreen(screen);
    if (fields[0]) fields[0].input.focus({ preventScroll: true });
  }

  function renderWaitingWrite(snapshot) {
    const screen = el('section', 'screen screen--waiting');
    screen.append(gamebar(snapshot, 'подпись отправлена'));

    const box = el('div', 'waiting');
    box.append(el('span', 'waiting__icon', '✍️'));
    box.append(el('h1', 'waiting__title screen__title', 'Подпись отправлена'));
    box.append(el('p', 'waiting__text', 'Ждём остальных: у каждого свой телефон и свой мем.'));
    const people = el('div', 'waiting__people');
    people.dataset.waiting = '';
    box.append(people);
    fillPeople(people, snapshot, 'submittedIds');
    screen.append(box);
    setScreen(screen);
  }

  function renderVote(snapshot) {
    const template = templateById(snapshot.templateId);
    const screen = el('section', 'screen screen--vote');
    screen.append(gamebar(snapshot, 'голосует'));

    const body = el('div', 'vote-body');
    const head = el('div', 'vote__head');
    head.append(el('h1', 'vote__title screen__title', 'Кто смешнее?'));
    head.append(el('p', 'vote__hint', 'Выбери один мем. За свой голосовать нельзя, авторы скрыты до конца раунда.'));
    body.append(head);

    const voters = el('div', 'voters');
    voters.dataset.voters = '';
    voters.dataset.hideSelf = '1';
    voters.setAttribute('aria-label', 'Кто уже проголосовал');
    body.append(voters);
    fillPeople(voters, snapshot, 'votedIds', snapshot.you.id);

    const grid = el('div', 'vote-grid');
    const confirm = el('button', 'btn btn--big vote__confirm', 'Сначала выбери мем');
    confirm.type = 'button';
    confirm.disabled = true;

    const ordered = (snapshot.displayOrder || []).map(function (id) {
      return (snapshot.memes || []).find(function (meme) { return meme.id === id; });
    }).filter(Boolean);

    ordered.forEach(function (meme, index) {
      const own = meme.id === snapshot.yourMemeId;
      const card = el('button', 'vote-card' + (own ? ' is-own' : ''));
      card.type = 'button';
      card.disabled = own;
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', 'Мем номер ' + (index + 1) + (own ? ', твой' : ''));
      card.append(el('span', 'vote-card__num', '#' + (index + 1)));
      card.append(buildMemeCard(template, meme.captions));
      if (own) card.append(el('span', 'vote-card__tag', 'твой мем'));

      card.addEventListener('click', function () {
        if (own) return;
        Array.prototype.forEach.call(grid.children, function (child) {
          const active = child === card;
          child.classList.toggle('is-selected', active);
          child.setAttribute('aria-pressed', String(active));
        });
        confirm.disabled = false;
        confirm.textContent = 'Отдать голос за #' + (index + 1);
        confirm.dataset.memeId = meme.id;
      });

      grid.append(card);
    });

    body.append(grid);

    const actions = el('div', 'vote__actions');
    actions.append(confirm);
    body.append(actions);

    confirm.addEventListener('click', function () {
      const memeId = confirm.dataset.memeId;
      if (!memeId) return;
      confirm.disabled = true;
      confirm.textContent = 'Отправляем…';
      if (S.isHost) {
        hostVote(snapshot.you.id, memeId);
      } else {
        sendToHost({ t: 'vote', memeId: memeId });
      }
    });

    screen.append(body);
    setScreen(screen);
  }

  function renderWaitingVote(snapshot) {
    const screen = el('section', 'screen screen--waiting');
    screen.append(gamebar(snapshot, 'голос принят'));

    const box = el('div', 'waiting');
    box.append(el('span', 'waiting__icon', '🗳️'));
    box.append(el('h1', 'waiting__title screen__title', 'Голос принят'));
    box.append(el('p', 'waiting__text', 'Ждём остальные голоса — результаты появятся сами.'));
    const people = el('div', 'waiting__people');
    people.dataset.waiting = '';
    box.append(people);
    fillPeople(people, snapshot, 'votedIds');
    screen.append(box);
    setScreen(screen);
  }

  function renderReveal(snapshot) {
    const template = templateById(snapshot.templateId);
    const memes = (snapshot.displayOrder || []).map(function (id) {
      return (snapshot.memes || []).find(function (meme) { return meme.id === id; });
    }).filter(Boolean);
    memes.sort(function (a, b) {
      const diff = b.votes.length - a.votes.length;
      if (diff !== 0) return diff;
      return snapshot.displayOrder.indexOf(a.id) - snapshot.displayOrder.indexOf(b.id);
    });
    const best = memes.length ? memes[0].votes.length : 0;

    const screen = el('section', 'screen screen--reveal');
    screen.append(gamebar(snapshot));
    screen.append(el('h1', 'reveal__title screen__title', 'Итоги раунда ' + (snapshot.round + 1)));
    screen.append(el(
      'p',
      'reveal__hint',
      best ? 'Один голос — одно очко. Вот как распределились симпатии.' : 'Голоса кончились, легенды остались.'
    ));

    const results = el('ol', 'results');
    memes.forEach(function (meme) {
      const player = playerById(snapshot, meme.playerId);
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
      info.append(el('p', 'result__votes', votesText(snapshot, meme)));
      info.append(el('p', 'result__points', (meme.votes.length ? '+' : '') + pointsLabel(meme.votes.length)));
      item.append(info);
      results.append(item);
    });
    screen.append(results);

    screen.append(el('h2', 'section-title', 'Счёт'));
    screen.append(scoresList(snapshot, snapshot.points));

    if (S.isHost) {
      const isLast = snapshot.round + 1 >= snapshot.rounds;
      const next = btn(isLast ? 'К финалу →' : 'Следующий раунд →', 'btn btn--big', nextRoundOrFinal);
      screen.append(next);
    } else {
      screen.append(el('p', 'guest-note', 'Ждём хоста: он решает, что дальше.'));
    }

    setScreen(screen);
  }

  function renderFinal(snapshot) {
    const sorted = snapshot.players.slice().sort(function (a, b) { return b.score - a.score; });
    const best = sorted.length ? sorted[0].score : 0;
    const winners = snapshot.players.filter(function (player) {
      return (snapshot.winners || []).indexOf(player.id) !== -1;
    });
    const medals = ['🥇', '🥈', '🥉'];

    const screen = el('section', 'screen screen--final');
    const hero = el('div', 'final__hero');
    hero.append(el('span', 'final__crown', winners.length > 1 ? '🤝' : '🏆'));
    hero.append(el('p', 'kicker', winners.length > 1 ? 'ничья, оба хороши' : 'победитель баттла'));
    hero.append(el('h1', 'final__name screen__title', winners.map(function (player) { return player.name; }).join(' и ') || 'Никто'));
    hero.append(el('p', 'final__score', pointsLabel(best)));
    screen.append(hero);

    const table = el('ol', 'scores scores--final');
    let place = 0;
    sorted.forEach(function (player, index) {
      if (index === 0 || player.score !== sorted[index - 1].score) place = index + 1;
      const row = el('li', 'score' + (place === 1 ? ' is-top' : ''));
      const medal = place <= 3 && player.score > 0 ? medals[place - 1] : String(place);
      row.append(el('span', 'score__place', medal));
      row.append(el('span', 'score__avatar', player.avatar || '🙂'));
      row.append(el('span', 'score__name', player.name));
      row.append(el('span', 'score__points', String(player.score)));
      table.append(row);
    });
    screen.append(table);

    if (S.isHost) {
      const actions = el('div', 'final__actions');
      actions.append(btn('Ещё раз →', 'btn btn--big', playAgain));
      actions.append(btn('Закрыть комнату', 'btn btn--ghost', leaveRoom));
      screen.append(actions);
    } else {
      screen.append(el('p', 'guest-note', 'Ждём хоста: он может начать новую игру.'));
      const leave = btn('Выйти из комнаты', 'btn btn--ghost', leaveRoom);
      leave.style.display = 'block';
      leave.style.margin = '18px auto 0';
      screen.append(leave);
    }

    setScreen(screen);

    const confettiKey = snapshot.round + '|' + winners.length;
    if (S.confettiKey !== confettiKey) {
      S.confettiKey = confettiKey;
      launchConfetti();
    }
  }

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
    const pieces = Array.from({ length: 130 }, function () {
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
      if (elapsed < 3000) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  function sendToHost(message) {
    if (S.isHost) return;
    if (S.hostConn && S.hostConn.open) {
      try { S.hostConn.send(message); } catch (error) {
        toast('Не удалось отправить. Проверьте соединение.');
      }
    } else {
      toast('Нет соединения с комнатой.');
    }
  }

  /* ---------- запуск ---------- */

  window.addEventListener('beforeunload', function () {
    if (S.peer) {
      try { S.peer.destroy(); } catch (error) {}
    }
  });

  renderLanding();
})();
