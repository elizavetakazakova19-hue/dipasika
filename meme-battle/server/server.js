import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('bad request');
    return;
  }

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, peers: peers.size }));
    return;
  }

  if (pathname === '/' || pathname === '') pathname = '/relay.html';

  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT) || file.includes(path.sep + 'server' + path.sep)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const peers = new Map();
const links = new Map();

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

function send(socket, message) {
  if (socket.readyState === 1) {
    try { socket.send(JSON.stringify(message)); } catch (error) {}
  }
}

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket, request) => {
  let peerId = '';
  try {
    peerId = new URL(request.url, 'http://localhost').searchParams.get('peer') || '';
  } catch {}
  peerId = peerId.slice(0, 64);

  if (!peerId || !/^[a-zA-Z0-9_-]+$/.test(peerId)) {
    send(socket, { type: 'error', code: 'bad-id' });
    socket.close();
    return;
  }
  if (peers.has(peerId)) {
    send(socket, { type: 'error', code: 'unavailable-id' });
    socket.close();
    return;
  }

  peers.set(peerId, { socket: socket });
  links.set(peerId, new Set());

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
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
      send(target.socket, { type: 'connection', from: peerId });
      send(socket, { type: 'connected', to: targetId });
      return;
    }

    if (message.type === 'data') {
      const targetId = String(message.to || '').slice(0, 64);
      const target = peers.get(targetId);
      if (!target) return;
      send(target.socket, { type: 'data', from: peerId, data: message.data });
      return;
    }

    if (message.type === 'close') {
      const targetId = String(message.to || '').slice(0, 64);
      const target = peers.get(targetId);
      if (target) send(target.socket, { type: 'conn-close', from: peerId });
      unlinkPeer(peerId, targetId);
      return;
    }
  });

  socket.on('close', () => {
    const known = links.get(peerId) || new Set();
    known.forEach((otherId) => {
      const other = peers.get(otherId);
      if (other) send(other.socket, { type: 'conn-close', from: peerId });
      if (links.has(otherId)) links.get(otherId).delete(peerId);
    });
    links.delete(peerId);
    peers.delete(peerId);
  });

  socket.on('error', () => {});
});

server.listen(PORT, () => {
  console.log('meme-battle relay on http://127.0.0.1:' + PORT);
});
