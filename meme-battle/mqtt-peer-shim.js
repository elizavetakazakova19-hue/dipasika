/* MQTT-транспорт с API PeerJS: комнаты живут на публичном брокере EMQX.
   Никакого своего сервера: браузеры общаются через топики membattle/v2/<peerId>. */
(function () {
  'use strict';

  const BROKER = 'wss://broker.hivemq.com:8884/mqtt';
  const FALLBACK_BROKER = 'wss://broker.emqx.io:8084/mqtt';
  const CDN = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
  const CDN_FALLBACK = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';
  const PREFIX = 'membattle/v2/';
  const CONNECT_TIMEOUT = 15000;

  let mqttLoading = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        if (window.mqtt) resolve();
        else reject(new Error('mqtt.js не загрузился'));
      };
      script.onerror = function () { reject(new Error('Не удалось загрузить ' + src)); };
      document.head.append(script);
    });
  }

  function loadMqtt() {
    if (window.mqtt) return Promise.resolve();
    if (mqttLoading) return mqttLoading;
    mqttLoading = loadScript(CDN).catch(function () { return loadScript(CDN_FALLBACK); });
    return mqttLoading;
  }

  function randomId() {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  }

  function safeId(value) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  }

  function topicFor(peerId) {
    return PREFIX + safeId(peerId);
  }

  function encode(data) {
    try { return JSON.stringify(data); } catch (error) { return null; }
  }

  function Peer(id, options) {
    if (id && typeof id === 'object') {
      options = id;
      id = '';
    }
    this.id = safeId(id || ('mqtt-' + randomId()));
    this.options = options || {};
    this._events = {};
    this._conns = new Map();
    this._pending = new Map();
    this._seen = new Set();
    this._destroyed = false;
    this._opened = false;
    this._client = null;

    const self = this;
    loadMqtt().then(function () { self._start(); }).catch(function (error) {
      self._emit('error', { type: 'network', message: error.message || 'MQTT недоступен' });
    });
  }

  Peer.prototype.on = function (event, handler) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
    return this;
  };

  Peer.prototype._emit = function (event, payload) {
    const list = this._events[event] || [];
    for (let index = 0; index < list.length; index += 1) {
      try { list[index](payload); } catch (error) { setTimeout(function () { throw error; }, 0); }
    }
  };

  Peer.prototype._start = function () {
    if (this._destroyed || this._client) return;
    const self = this;

    function connectTo(url) {
      return window.mqtt.connect(url, {
        clientId: 'mb_' + self.id + '_' + randomId(),
        clean: true,
        reconnectPeriod: 3000,
        connectTimeout: 15000,
        keepalive: 30,
        protocolVersion: 4
      });
    }

    const client = connectTo(BROKER);
    this._client = client;

    client.on('connect', function () {
      client.subscribe(topicFor(self.id), { qos: 1 }, function (error) {
        if (error) {
          self._emit('error', { type: 'network', message: 'Не удалось подписаться на комнату' });
          return;
        }
        if (!self._opened) {
          self._opened = true;
          self._emit('open', self.id);
        } else {
          self._emit('open', self.id);
        }
      });
    });

    client.on('message', function (ignoreTopic, payload) {
      self._onMessage(payload.toString());
    });

    client.on('error', function (error) {
      self._emit('error', { type: 'network', message: error && error.message ? error.message : 'Ошибка MQTT' });
    });

    client.on('close', function () {
      self._emit('disconnected');
    });

    let triedFallback = false;
    client.on('error', function () {
      if (triedFallback || !self._client) return;
      triedFallback = true;
      try { self._client.end(true); } catch (error) {}
      const fallback = connectTo(FALLBACK_BROKER);
      self._client = fallback;
      fallback.on('connect', function () {
        fallback.subscribe(topicFor(self.id), { qos: 1 });
        if (!self._opened) {
          self._opened = true;
          self._emit('open', self.id);
        }
      });
      fallback.on('message', function (ignoreTopic, payload) { self._onMessage(payload.toString()); });
      fallback.on('error', function (error) {
        self._emit('error', { type: 'network', message: error && error.message ? error.message : 'Ошибка MQTT' });
      });
      fallback.on('close', function () { self._emit('disconnected'); });
    });
  };

  Peer.prototype._publish = function (topic, data) {
    const client = this._client;
    if (!client || !client.connected) return false;
    const payload = encode(data);
    if (!payload) return false;
    try {
      client.publish(topic, payload, { qos: 1 });
      return true;
    } catch (error) {
      return false;
    }
  };

  Peer.prototype._onMessage = function (raw) {
    let message;
    try { message = JSON.parse(raw); } catch (error) { return; }
    if (!message || !message.from || message.from === this.id) return;

    if (message.id) {
      if (this._seen.has(message.id)) return;
      this._seen.add(message.id);
      if (this._seen.size > 600) {
        const first = this._seen.values().next().value;
        this._seen.delete(first);
      }
    }

    if (message.t === 'c') {
      let conn = this._conns.get(message.from);
      if (!conn) {
        conn = new Connection(this, message.from, true);
        this._conns.set(message.from, conn);
      }
      if (!conn._open) {
        conn._open = true;
        conn.open = true;
        conn._emit('open');
        this._emit('connection', conn);
        this._publish(topicFor(message.from), { t: 'a', from: this.id, to: message.from, id: randomId() });
      }
      return;
    }

    if (message.t === 'a') {
      const conn = this._pending.get(message.from);
      if (conn) {
        clearTimeout(conn._timeout);
        this._pending.delete(message.from);
        this._conns.set(message.from, conn);
        conn._open = true;
        conn.open = true;
        conn._emit('open');
        conn._flush();
      }
      return;
    }

    if (message.t === 'd') {
      const conn = this._conns.get(message.from);
      if (conn) conn._emit('data', message.p);
      return;
    }

    if (message.t === 'x') {
      const conn = this._conns.get(message.from);
      if (conn) conn._closeRemote();
    }
  };

  Peer.prototype.connect = function (target, options) {
    const peer = safeId(target);
    const conn = new Connection(this, peer, false);
    this._pending.set(peer, conn);
    const self = this;
    loadMqtt().then(function () {
      if (!self._client) {
        conn._fail('peer-unavailable');
        return;
      }
      self._publish(topicFor(peer), { t: 'c', from: self.id, to: peer, id: randomId() });
    });
    conn._timeout = setTimeout(function () {
      if (!conn._open) conn._fail('peer-unavailable');
    }, CONNECT_TIMEOUT);
    return conn;
  };

  Peer.prototype.reconnect = function () {
    if (this._client) {
      try { this._client.reconnect(); } catch (error) {}
    }
  };

  Peer.prototype.destroy = function () {
    this._destroyed = true;
    this._conns.forEach(function (conn) { conn._shutdown(); });
    this._pending.forEach(function (conn) { conn._shutdown(); });
    this._conns.clear();
    this._pending.clear();
    if (this._client) {
      try { this._client.end(true); } catch (error) {}
    }
  };

  function Connection(peer, targetId, incoming) {
    this.peer = safeId(targetId);
    this.peerConnection = this;
    this._peer = peer;
    this._open = false;
    this.open = false;
    this._closed = false;
    this._incoming = !!incoming;
    this._events = {};
    this._queue = [];
  }

  Connection.prototype.on = function (event, handler) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
    return this;
  };

  Connection.prototype._emit = function (event, payload) {
    const list = this._events[event] || [];
    for (let index = 0; index < list.length; index += 1) {
      try { list[index](payload); } catch (error) { setTimeout(function () { throw error; }, 0); }
    }
  };

  Connection.prototype.send = function (data) {
    if (this._closed) return;
    if (!this._open) {
      this._queue.push(data);
      return;
    }
    this._peer._publish(topicFor(this.peer), { t: 'd', from: this._peer.id, to: this.peer, p: data, id: randomId() });
  };

  Connection.prototype._flush = function () {
    while (this._queue.length && this._open) {
      this.send(this._queue.shift());
    }
  };

  Connection.prototype.close = function () {
    if (!this._closed && this._open) {
      this._peer._publish(topicFor(this.peer), { t: 'x', from: this._peer.id, to: this.peer, id: randomId() });
    }
    this._shutdown();
  };

  Connection.prototype._shutdown = function () {
    if (this._closed) return;
    this._closed = true;
    clearTimeout(this._timeout);
    this._open = false;
    this.open = false;
    this._peer._conns.delete(this.peer);
    this._peer._pending.delete(this.peer);
    this._emit('close');
  };

  Connection.prototype._closeRemote = function () {
    this._shutdown();
  };

  Connection.prototype._fail = function (type) {
    this._shutdown();
    const error = { type: type || 'peer-unavailable', message: 'Комната не отвечает' };
    this._peer._emit('error', error);
    this._emit('error', error);
  };

  window.Peer = Peer;
})();
