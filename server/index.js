/* ==========================================================
   El Wasseya — Node.js server (for your computer, or any Node host).
   For free hosting without a card, use Cloudflare instead (see README).
   ========================================================== */
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const E = require('../public/engine.js');
const { RoomCore } = require('../shared/room.js');

const PORT = process.env.PORT || 3000;
const EMPTY_ROOM_TTL = 10 * 60 * 1000;   // forget a room 10 min after the last player leaves
const MAX_ROOMS = 500;

const app = express();
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

/** code -> RoomCore */
const rooms = new Map();
app.get('/api/rooms', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json([...rooms.values()].map(r => r.summary()).filter(s => s.open).slice(0, 30));
});
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws, req) => {
  const code = String(new URL(req.url, 'http://x').searchParams.get('code') || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) return ws.close(1008, 'bad code');
  const conn = {
    pid: null,
    send: obj => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); },
    close: () => { try { ws.close(1000, 'replaced'); } catch (e) {} },
  };
  ws.on('message', data => {
    let msg; try { msg = JSON.parse(data); } catch (e) { return; }
    let room = rooms.get(code);
    if (!room) {
      if (msg.t !== 'create') return conn.send({ t: 'err', e: 'notfound' });
      if (rooms.size >= MAX_ROOMS) return conn.send({ t: 'err', e: 'busy' });
      room = new RoomCore(code, E);
      rooms.set(code, room);
    }
    room.handle(conn, msg);
  });
  ws.on('close', () => { const room = rooms.get(code); if (room) room.close(conn, false); });
});

/* game loop */
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (!room.host || (room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL)) {
      if (!room.conns.size) { rooms.delete(code); continue; }
    }
    try { room.tick(); } catch (err) { console.error('room', code, err); }
  }
}, 200);

server.listen(PORT, () => console.log(`El Wasseya is running on http://localhost:${PORT}`));
