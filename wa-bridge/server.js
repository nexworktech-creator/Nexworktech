// Nexwork demo bridge: real WhatsApp QR link -> 10 minute demo session -> commands drive the smart home page.
// UNOFFICIAL WhatsApp Web protocol (Baileys). Use a spare/test number, not your main one.
import express from 'express';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const SESSION_MS = 10 * 60 * 1000;
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dir, 'public')));

let sess = null;            // one demo session at a time (extend to a Map for many visitors)
const pageClients = new Set();   // SSE listeners = smart home page(s)

const push = (obj) => pageClients.forEach((r) => r.write(`data: ${JSON.stringify(obj)}\n\n`));

async function stopSession(reason = 'expired') {
  if (!sess) return;
  clearTimeout(sess.timer);
  try { await sess.sock.logout(); } catch {}
  try { sess.sock.end(); } catch {}
  fs.rmSync(sess.dir, { recursive: true, force: true });   // delete the linked-device credentials
  sess.status = reason; sess.qr = null;
  const done = sess; sess = null; lastEnded = { reason, at: Date.now() };
  return done;
}
let lastEnded = null;
const sentIds = new Set();   // ids of our own replies, so we never answer ourselves

async function startSession() {
  if (sess) await stopSession('restarted');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-'));
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const s = { dir, status: 'waiting_qr', qr: null, startedAt: null, timer: null, sock: null };
  const connect = () => {
    s.sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: false });
    s.sock.ev.on('creds.update', saveCreds);
    s.sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
      if (qr) s.qr = await QRCode.toDataURL(qr);
      if (connection === 'open' && !s.startedAt) {
        s.status = 'active'; s.qr = null; s.startedAt = Date.now();
        s.timer = setTimeout(async () => {                       // 10 minute limit
          try { await s.sock.sendMessage(s.jid, { text: 'Demo time (10 min) khatam. Nexwork Tech se inquiry bhejo!' }); } catch {}
          stopSession('expired');
        }, SESSION_MS);
      }
      if (connection === 'close' && sess === s) {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.restartRequired || s.status === 'waiting_qr') connect(); // normal after QR scan
        else stopSession('disconnected');
      }
    });
    s.sock.ev.on('messages.upsert', ({ messages }) => {
      for (const m of messages) {
        if (s.status !== 'active' || sentIds.has(m.key.id)) continue;
        const own = (s.sock.user?.id || '').split(':')[0].split('@')[0];
        const chatUser = (m.key.remoteJid || '').split('@')[0];
        if (m.key.fromMe && chatUser !== own) continue;           // fromMe only allowed in "Message yourself" chat
        const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
        if (!text) continue;
        s.jid = m.key.remoteJid;
        push({ from: m.key.remoteJid, text });                    // page runs the command, posts result to /reply
      }
    });
  };
  sess = s; connect();
}

app.post('/start', async (_req, res) => { await startSession(); res.json({ ok: true }); });
app.get('/status', (_req, res) => {
  if (!sess) return res.json({ status: lastEnded?.reason || 'idle' });
  res.json({ status: sess.status, qr: sess.qr,
    secondsLeft: sess.startedAt ? Math.max(0, Math.round((SESSION_MS - (Date.now() - sess.startedAt)) / 1000)) : null });
});
app.post('/stop', async (_req, res) => { await stopSession('stopped'); res.json({ ok: true }); });
app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders(); res.write(': ok\n\n');
  pageClients.add(res);
  req.on('close', () => { pageClients.delete(res); if (!pageClients.size) stopSession('page closed'); }); // site band = bot band
});
app.post('/reply', async (req, res) => {
  if (sess?.status === 'active' && req.body?.to && req.body?.text) {
    const r = await sess.sock.sendMessage(req.body.to, { text: String(req.body.text).slice(0, 1000) });
    if (r?.key?.id) sentIds.add(r.key.id);
  }
  res.json({ ok: true });
});

app.listen(3000, () => console.log('Open http://localhost:3000  (QR page: /connect.html)'));
