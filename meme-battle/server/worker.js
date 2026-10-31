const CLIENT_URL = 'https://elizavetakazakova19-hue.github.io/dipasika/meme-battle/relay.html';

export class Relay {
  constructor(state) {
    this.state = state;
  }

  find(peerId) {
    return this.state.getWebSockets().find((socket) => {
      const meta = socket.deserializeAttachment();
      return meta && meta.peerId === peerId;
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const upgrade = (request.headers.get('Upgrade') || '').toLowerCase();

    if (upgrade !== 'websocket') {
      if (url.pathname === '/health') {
        return Response.json({ ok: true, peers: this.state.getWebSockets().length });
      }
      if (url.pathname === '/' || url.pathname === '') {
        const host = request.headers.get('host') || url.host;
        return Response.redirect(CLIENT_URL + '?server=' + encodeURIComponent('wss://' + host), 302);
      }
      return new Response('meme-battle relay', { status: 200 });
    }

    const peerId = (url.searchParams.get('peer') || '').slice(0, 64);
    const valid = /^[a-zA-Z0-9_-]+$/.test(peerId);
    const existing = valid ? this.find(peerId) : null;

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ peerId });

    if (!valid || existing) {
      server.send(JSON.stringify({ type: 'error', code: valid ? 'unavailable-id' : 'bad-id' }));
      server.close(1000, valid ? 'unavailable-id' : 'bad-id');
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;

    const from = (socket.deserializeAttachment() || {}).peerId;
    const targetId = String(data.to || '').slice(0, 64);
    const target = this.find(targetId);

    if (data.type === 'connect') {
      if (!target) {
        socket.send(JSON.stringify({ type: 'error', code: 'peer-unavailable' }));
        return;
      }
      target.send(JSON.stringify({ type: 'connection', from }));
      socket.send(JSON.stringify({ type: 'connected', to: targetId }));
      return;
    }

    if (data.type === 'data' && target) {
      target.send(JSON.stringify({ type: 'data', from, data: data.data }));
      return;
    }

    if (data.type === 'close' && target) {
      target.send(JSON.stringify({ type: 'conn-close', from }));
    }
  }

  webSocketClose(socket) {
    const from = (socket.deserializeAttachment() || {}).peerId;
    for (const other of this.state.getWebSockets()) {
      if (other === socket) continue;
      try {
        other.send(JSON.stringify({ type: 'conn-close', from }));
      } catch {}
    }
  }

  webSocketError() {}
}

export default {
  async fetch(request, env) {
    const id = env.RELAY.idFromName('global');
    return env.RELAY.get(id).fetch(request);
  }
};
