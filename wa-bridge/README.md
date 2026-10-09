# Nexwork WhatsApp demo bridge
1. `npm install` then `npm start` (Node 18+)
2. Open http://localhost:3000/connect.html -> Start demo -> scan QR (WhatsApp > Linked devices)
3. Open http://localhost:3000/ in another tab and keep it open
4. From the linked phone send: light on, fan on, ac on, temp 22, door open, water level
   Easiest test: open the "Message yourself" chat on the linked phone and type the commands there, or ask a friend to message that number.
Session lasts 10 minutes, or ends when the site tab closes. Linked-device credentials are deleted when it ends.
Notes: Baileys is an unofficial library. WhatsApp can restrict numbers that use it, so use a spare number.
The official WhatsApp Cloud API has no QR linking; use it for the paid product.
Production: add one session per visitor, rate limits, and the inquiry form after expiry.
