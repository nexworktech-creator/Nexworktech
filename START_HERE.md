# Nexwork Tech: Stages 1 to 7

## What is in this zip
- previews/  Stage 1, 2 and 3 as standalone HTML pages. Double-click a file to open it in a browser, no install needed.
  - stage1-intro-homepage.html: cinematic intro, hero, services overview, small Smart Home simulation
  - stage2-services-about-contact.html: 8 service pages, portfolio, about, contact form (the form sends nothing yet)
  - stage3-live-demos.html: Smart Home, IoT Sensor Dashboard, Automation Builder, Website Chatbot (all simulated)
- backend/   Stage 4 to 7 as Next.js + Prisma + PostgreSQL source files (database schema, inquiry API, admin screen,
  students and certificates, IoT devices, automation engine, WhatsApp/Instagram webhook, login, tests, deployment guide).
  Read backend/README.md first, then backend/docs/DEPLOYMENT.md.

## Honest status
- The previews and the backend are NOT merged into one Next.js project yet. The backend files must be copied into a
  Next.js 14 + TypeScript + Tailwind project (steps are in backend/README.md).
- Only the automation engine, password and route-guard logic were run and tested (11 tests). The rest was written
  carefully but has not been run against a real database or Next.js server.
- Not built: student/customer login and dashboards, email/notification sending, file uploads, content/reviews/team admin
  screens, MQTT bridge, remaining 6 demos (Arduino/ESP32 lab, WhatsApp builder, Instagram, GPS, Cloud, SaaS builder),
  browser end-to-end tests.
- Sample/placeholder content is labelled as such. Add real contact details, team photos and projects before launch.

## First run (short version)
1. Create a project: npx create-next-app@14 nexwork --typescript --tailwind --app
2. Copy the contents of backend/ into it (merge folders), then follow backend/README.md.
3. Create your admin with scripts/create-admin.ts, open /admin.

## Added later: Smart Home demo + real WhatsApp QR bridge
- previews/smart-home-demo.html: room (2 lights, fan, AC, door alarm) + rooftop water tank with auto pump + mobile-app panel + chat commands. Double-click to open; works standalone.
- wa-bridge/: Node server for the real WhatsApp QR link (10 minute session, ends when the demo tab closes). See wa-bridge/README.md. Untested against a real WhatsApp account; uses the unofficial Baileys library, so use a spare number.
