/* Небольшая замена PeerJS поверх WebSocket: тот же API, но сообщения идут
   через наш релей, а не напрямую между браузерами. */
(function () {
  'use strict';

  function randomId() {
    return 'ws-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  }

  function Connection(peer, remoteId) {
    this.peer = peer;
    this.remoteId = remoteId;
    this.open = false;
    this._handlers = {};
  }

  Connection.prototype.on = function (event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  };

  Connection.prototype._emit = function (event) {
    const args = Array.prototype.slice.call(arguments, 1);
    (this._handlers[event] || []).forEach(function (handler) {
      handler.apply(null, args);
    });
  };

  Connection.prototype.send = function (data) {
    this.peer._send({ type: 'data', to: this.remoteId, data: data });
  };

  Connection.prototype.close = function () {
    this.peer._send({ type: 'close', to: this.remoteId });
    this._shutdown();
  };

  Connection.prototype._open = function () {
    if (this.open) return;
    this.open = true;
    this._emit('open');
  };

  Connection.prototype._shutdown = function () {
    if (!this.open) return;
    this.open = false;
    this._emit('close');
  };

  function Peer(id, options) {
    if (id && typeof id === 'object') {
      options = id;
      id = '';
    }
    this.id = id || randomId();
    this.options = options || {};
    this.connections = new Map();
    this._handlers = {};
    this.destroyed = false;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this._socket = new WebSocket(protocol + '//' + location.host + '/ws?peer=' + encodeURIComponent(this.id));
    this._socket.onopen = () => {
      this._emit('open', this.id);
    };
    this._socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      this._onMessage(message);
    };
    this._socket.onclose = () => {
      this.connections.forEach(function (connection) { connection._shutdown(); });
      if (!this.destroyed) this._emit('disconnected');
    };
    this._socket.onerror = () => {
      if (!this.destroyed) this._emit('error', { type: 'network' });
    };
  }

  Peer.prototype.on = function (event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  };

  Peer.prototype._emit = function (event) {
    const args = Array.prototype.slice.call(arguments, 1);
    (this._handlers[event] || []).forEach(function (handler) {
      handler.apply(null, args);
    });
  };

  Peer.prototype.connect = function (remoteId) {
    const connection = new Connection(this, remoteId);
    this.connections.set(remoteId, connection);
    this._send({ type: 'connect', to: remoteId });
    return connection;
  };

  Peer.prototype._send = function (message) {
    if (this._socket.readyState === 1) {
      try { this._socket.send(JSON.stringify(message)); } catch (error) {}
    }
  };

  Peer.prototype._onMessage = function (message) {
    if (message.type === 'connected') {
      const connection = this.connections.get(message.to);
      if (connection) connection._open();
      return;
    }

    if (message.type === 'error') {
      const type = message.code === 'unavailable-id' ? 'unavailable-id'
        : message.code === 'peer-unavailable' ? 'peer-unavailable'
          : 'network';
      this._emit('error', { type: type });
      return;
    }

    if (message.type === 'connection') {
      const connection = new Connection(this, message.from);
      this.connections.set(message.from, connection);
      connection._open();
      this._emit('connection', connection);
      return;
    }

    if (message.type === 'data') {
      const connection = this.connections.get(message.from);
      if (connection) connection._emit('data', message.data);
      return;
    }

    if (message.type === 'conn-close') {
      const connection = this.connections.get(message.from);
      if (connection) {
        connection._shutdown();
        this.connections.delete(message.from);
      }
    }
  };

  Peer.prototype.destroy = function () {
    this.destroyed = true;
    this.connections.forEach(function (connection) { connection._shutdown(); });
    this.connections.clear();
    try { this._socket.close(); } catch (error) {}
  };

  window.Peer = Peer;
})();
