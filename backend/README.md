# Nexwork Tech backend (Stage 4)
Copy these folders into a Next.js 14 + TypeScript project (`npx create-next-app@14`).
1. `npm i @prisma/client@5 zod@3 pdf-lib qrcode && npm i -D prisma@5 @types/qrcode` (Prisma 5 is pinned because the schema uses `url = env(...)`)
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to a running PostgreSQL.
3. `npx prisma migrate dev --name init`
4. Seed services and demos: `npm i -D tsx`, add `"prisma": { "seed": "tsx prisma/seed.ts" }` to package.json, then `npx prisma db seed`
5. `npm run dev`, then open http://localhost:3000/admin and sign in with the admin you create in Stage 7
   (the screens use Tailwind: create the project with `--tailwind`)

Test the inquiry API:
curl -X POST localhost:3000/api/inquiries -H 'content-type: application/json' -d '{"fullName":"Test User","phone":"+911234567890","email":"t@example.com","city":"Varanasi","features":[],"description":"Need a smart home demo","contactVia":"Email","consent":true}'

List inquiries: curl -b jar -H 'origin: http://localhost:3000' localhost:3000/api/admin/inquiries

Admin routes need a signed-in session (Stage 7 section below).
Admin screen: summary counts, search, status filter, status updates, CSV export (spreadsheet-formula safe).
Not included yet: assigning leads and internal notes in the UI, service/demo/content management screens, email/WhatsApp notifications, Stage 2 form wiring.

## Stage 5: courses and certificates
Run `npx prisma migrate dev --name students-certificates`, then `npx prisma db seed` (adds 4 courses).
Flow (sign in first, see the Stage 7 section):
1. Create a student + enrollment:  curl -b jar -H 'origin: http://localhost:3000' -X POST localhost:3000/api/admin/students -H 'content-type: application/json' -d '{"fullName":"Asha Verma","email":"asha@example.com","courseSlug":"arduino"}'   -> returns regNo and enrollmentIds
2. Issue the certificate:          curl -b jar -H 'origin: http://localhost:3000' -X POST localhost:3000/api/admin/certificates -H 'content-type: application/json' -d '{"enrollmentId":"<id>","override":true}'   -> returns certId
   Without `override` it requires the course's approved-assignment count; the override is written to the audit log.
3. Open http://localhost:3000/verify and enter the certId to verify and download the PDF.
4. Revoke: curl -b jar -H 'origin: http://localhost:3000' -X PATCH localhost:3000/api/admin/certificates -H 'content-type: application/json' -d '{"certId":"<certId>"}'

Rules enforced: certificates exist only for staff-created records; nothing is issued from a phone number;
a registration number shows status only, never the certificate ID or PDF; revoked certificates fail verification.
Not built yet: student register/login/dashboard, course catalog UI, student assignment submission and
staff review screens (they need the Stage 7 login), Unicode fonts in the PDF.

## Stage 6: devices, automation, chatbot webhooks
Run `npx prisma migrate dev --name devices-automation`. Hardware steps: docs/IOT_GUIDE.md.
- Workflows: `POST /api/admin/workflows` saves a validated definition; `POST /api/admin/workflows/<id>/run` with
  `{"mode":"TEST","context":{...}}` simulates every step (nothing is sent). `PRODUCTION` needs the workflow enabled and
  each step's integration configured; unconfigured steps fail with "Not configured" instead of pretending to work.
- Production-ready steps now: `crm_update` (internal), `ai_text` (needs ANTHROPIC_API_KEY), `send_whatsapp` (needs WHATSAPP_TOKEN and
  WHATSAPP_PHONE_ID). `email_notification`, `approval` and `delay` run in test mode only until a mail adapter, approvals screen and job queue exist.
- Chatbots: point Meta's webhook at `/api/webhooks/meta` (verify token = META_VERIFY_TOKEN, signatures checked with META_APP_SECRET).
  Enabled workflows whose trigger is `inbound_message` run on each incoming WhatsApp or Instagram text, with context `{channel, from, text}`.
  Check Meta's current Graph API version and WhatsApp's 24-hour reply-window rules before going live.
Not built yet: SSE live stream, MQTT bridge, workflow builder screens, customer-owned workflows (need Stage 7 login), job queue for delays and schedules.

## Stage 7: sign-in, security, tests
- Create the first admin: `ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a-long-unique-pass-9' npx tsx scripts/create-admin.ts`
- Browser: open /admin and sign in. curl: `curl -c jar -H 'origin: http://localhost:3000' -H 'content-type: application/json' -d '{"email":"you@company.com","password":"..."}' localhost:3000/api/auth/login`, then add `-b jar -H 'origin: http://localhost:3000'` to admin calls.
- Passwords: scrypt with per-user salt. Sessions: random token in an httpOnly cookie, only its hash stored, 8-hour life, revoked on logout. Login is rate limited per IP and per email.
- Tests: `npm i -D vitest` then `npx vitest run` (passwords, route guards and CSRF, automation engine).
- Deployment and admin setup: docs/DEPLOYMENT.md
