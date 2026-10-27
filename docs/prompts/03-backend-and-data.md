# Phase 3 · Real backend and database for the panel and the app

## Goal

Replace the in-memory mock store with a real database and a backend that both the admin panel (`in-web`) and the mobile app (`../in-app`) use. When this is done, a booking made in the app shows up in the panel's Agenda, a payment registered at the desk shows in the member's history, and data survives restarts. Every rule that today lives in the mock actions (overlaps, deposits, refunds, roles) is enforced by the backend.

Out of scope: Mercado Pago (Phase 4), push delivery (Phase 5) and switching the mobile app's screens over (Phase 6). This phase builds the backend and moves the **panel** onto it. It also exposes the API the app will use.

## Project context

- Repos: `in-web` (Next.js 16 admin panel, this folder) and `../in-app` (Expo app). Read both `AGENTS.md` files and `../in-app/docs/instructivo.md` section 9 ("Dejar todo listo para el backend"): the app sends the Firebase ID token as `Authorization: Bearer <token>`, the backend verifies it with Firebase Admin, and the Firebase UID is the member's id.
- Phase 2 must be done first: staff sessions and role claims come from Firebase.
- The panel's data layer is built to be swapped. Screens only call `lib/data/<feature>/service.ts` (reads) and `lib/data/<feature>/actions.ts` (server actions). Domain types are in `lib/data/types.ts`; rules live in the actions (`lib/data/bookings/actions.ts` and `schedule.ts` for overlaps, `club/pricing.ts` for prices). Seed data matching the Paper designs is in `lib/data/mock/seed.ts`.
- The app has the same seam: `../in-app/src/features/*/service.ts` with `isMockBackend = true`, plus `types.ts` and `mock-data.ts` per feature. Read its types: the backend must serve both shapes or a shared one.
- Use `ctx7` for current docs of whatever database, ORM or SDK you pick.

## Architecture (decide with the user before writing code)

Present two or three options with trade-offs (cost, ops, how the app and panel reach it, transactions for overlapping bookings, local dev, migration effort), recommend one, and wait for the user's choice. Options to consider:

- **A. Postgres + an API inside `in-web`.** Postgres (Neon, Supabase or Cloud SQL) with Drizzle; the panel uses it directly from server code; the app calls `in-web`'s route handlers under `/api/v1/*` with its ID token. One deployable; real transactions and exclusion constraints for court overlaps (`tstzrange` + `EXCLUDE USING gist`).
- **B. Firestore + Cloud Functions.** Already in the Firebase project; security rules for reads; Cloud Functions (callable or HTTP) for writes with rules (booking, cancel, refund). Overlap checks need transactions on a per-court-per-day document.
- **C. A separate API service** (e.g. Hono/Fastify on Cloud Run) with Postgres, used by both the panel and the app.

Whichever is chosen: the Firebase UID is the key for members and staff; times are stored in UTC with the club's time zone (`America/Argentina/Buenos_Aires`) applied for display and for day boundaries; money is stored as integer pesos.

## Steps

1. Read the code listed above and write the data model from `lib/data/types.ts` and the app's `types.ts`: members, staff, courts, rate bands, booking rules, club settings and closed days, bookings with history, court blocks, payments, fixed slots, open matches and their players, events and attendees, reports, notifications. Flag where the panel's and app's types disagree and propose the shared shape.
2. Confirm the architecture and the model with the user.
3. Set up the database, migrations and a seed script that loads `lib/data/mock/seed.ts` (so screens still match Paper in development). Separate dev, staging (`in-gorina-staging`) and production environments, with env vars documented in `.env.example`.
4. Implement the services and actions against the database, feature by feature, without changing the screens: bookings and blocks (overlap enforced in the database, not only in code), payments, fixed slots, matches, members, events, moderation, notifications (store only; delivery is Phase 5), club settings, staff. Keep each function's signature and `ActionResult` shape. Keep `runAction(permission, …)` on every write.
5. Rules the backend must own (today they're in mock actions): booking price from rate bands; deposit expiry releasing the slot (scheduled job or check-on-read, propose which); refund only with `senas.devolver`; blocks and closed days cancel clashing bookings with history entries; at least one admin; blocked members can't book.
6. Expose the app API (if the chosen option uses one): versioned, ID-token auth, input validation (zod), consistent error codes the app can map to Spanish messages. List the endpoints each `../in-app/src/features/*/service.ts` needs.
7. Make reads that can be slow or dynamic work with `cacheComponents`: Suspense where pages read per-request data, `"use cache"` plus tags only for data that is the same for every staff member (rates, courts, club settings), and `updateTag`/`revalidateTag` after writes. Follow `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.
8. Remove `MOCK_NOW` usage from `lib/dates.ts` (the panel uses the real clock now), but keep the seed for local development.
9. Tests for the rules in step 5 (unit tests on the domain logic plus a few integration tests against a test database).

## Done when

- The panel works end to end against the database; restarting the server keeps all data.
- Two staff members booking the same court and time at once: one succeeds, the other gets "Cancha X ya está reservada…".
- Role checks happen on the server for every write and for the app API.
- Seed, migrations, env vars and how to run everything locally are in the README.
- `pnpm exec tsc --noEmit`, `pnpm lint`, the tests and `pnpm build` pass.

Report: the chosen architecture and why, the data model, the app API endpoints, and anything left for Phase 6.
