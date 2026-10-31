/* Релей комнат для Deno Deploy: тот же протокол, что и server.js.
   Запуск локально: deno run --allow-net deno.js */
const CLIENT_URL = 'https://elizavetakazakova19-hue.github.io/dipasika/meme-battle/relay.html';
const peers = new Map();
const links = new Map();

function send(socket, message) {
  try {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  } catch (error) {}
}

function linkPeer(a, b) {
  if (!links.has(a)) links.set(a, new Set());
  if (!links.has(b)) links.set(b, new Set());
  links.get(a).add(b);
  links.get(b).add(a);
}

function unlinkPeer(a, b) {
  if (links.has(a)) links.get(a).delete(b);
  if (links.has(b)) links.get(b).delete(a);
}

Deno.serve((request) => {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    return Response.json({ ok: true, peers: peers.size });
  }

  if (url.pathname === '/' || url.pathname === '') {
    const host = request.headers.get('host') || url.host;
    return Response.redirect(CLIENT_URL + '?server=' + encodeURIComponent('wss://' + host), 302);
  }

  if (url.pathname !== '/ws') {
    return new Response('meme-battle relay', { status: 200 });
  }

  const upgrade = request.headers.get('upgrade') || '';
  if (upgrade.toLowerCase() !== 'websocket') {
    return new Response('websocket required', { status: 426 });
  }

  const peerId = (url.searchParams.get('peer') || '').slice(0, 64);
  const { socket, response } = Deno.upgradeWebSocket(request);

  if (!/^[a-zA-Z0-9_-]+$/.test(peerId) || peers.has(peerId)) {
    socket.onopen = () => {
      send(socket, { type: 'error', code: peers.has(peerId) ? 'unavailable-id' : 'bad-id' });
      socket.close();
    };
    return response;
  }

  peers.set(peerId, socket);
  links.set(peerId, new Set());

  socket.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!message || typeof message !== 'object') return;

    if (message.type === 'connect') {
      const targetId = String(message.to || '').slice(0, 64);
      const target = peers.get(targetId);
      if (!target) {
        send(socket, { type: 'error', code: 'peer-unavailable' });
        return;
      }
      linkPeer(peerId, targetId);
      send(target, { type: 'connection', from: peerId });
      send(socket, { type: 'connected', to: targetId });
      return;
    }

    if (message.type === 'data') {
      const targetId = String(message.to || '').slice(0, 64);
      const target = peers.get(targetId);
      if (target) send(target, { type: 'data', from: peerId, data: message.data });
      return;
    }

    if (message.type === 'close') {
      const targetId = String(message.to || '').slice(0, 64);
      const target = peers.get(targetId);
      if (target) send(target, { type: 'conn-close', from: peerId });
      unlinkPeer(peerId, targetId);
    }
  };

  socket.onclose = () => {
    const known = links.get(peerId) || new Set();
    known.forEach((otherId) => {
      const other = peers.get(otherId);
      if (other) send(other, { type: 'conn-close', from: peerId });
      if (links.has(otherId)) links.get(otherId).delete(peerId);
    });
    links.delete(peerId);
    peers.delete(peerId);
  };

  socket.onerror = () => {};

  return response;
});
