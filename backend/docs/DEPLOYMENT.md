# Deployment and admin setup
## Before the first deploy
1. Use HTTPS only (the session cookie is `Secure` in production). Put the app behind a proxy that sets `X-Forwarded-Host`.
2. Set production env vars from `.env.example`: `DATABASE_URL` (managed PostgreSQL, TLS on), `APP_URL`, `CERT_SIGNATORY`, plus
   only the integration keys you actually use. Keep them in your host's secret store, never in git or frontend code.
3. `npx prisma migrate deploy` then `npx prisma db seed`.
4. Create the first admin (strong password, 12+ characters): `ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/create-admin.ts`.
   There is no default or test account anymore; `admin` / `12345` no longer works anywhere.
5. Run the tests: `npm i -D vitest && npx vitest run`.
## Hardening still on your list
- Rate limiting is in process memory: use Redis or your CDN's limiter if you run more than one instance.
- Add a nonce-based Content-Security-Policy in middleware; add backups and point-in-time recovery for PostgreSQL.
- Rotate device tokens by re-registering a device; delete old sessions with `DELETE FROM "Session" WHERE "expiresAt" < now()` on a schedule.
- Meta webhooks: set `META_APP_SECRET` and `META_VERIFY_TOKEN`, then register `https://YOUR_DOMAIN/api/webhooks/meta`.
- Roles: SUPER_ADMIN and ADMIN manage everything; STAFF can work inquiries only. Customer and student logins are not built yet.
- Audit log records logins, certificate and inquiry changes (actor on login only for now).
## Not covered yet
End-to-end browser tests (Playwright), email provider adapter, background job queue, MQTT bridge, file uploads, customer and student portals.
