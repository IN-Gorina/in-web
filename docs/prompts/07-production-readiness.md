# Phase 7 · Production readiness for the admin panel

## Goal

Make `in-web` ready for the club's staff to use every day: it works on the screens they actually have, fails gracefully, is tested, monitored and deployed with separate staging and production environments.

## Project context

- `in-web` (Next.js 16, `cacheComponents` on). Phases 2–6 are done or in progress; read the README for env vars and the backend.
- Designs are 1440×900 only (Paper "Panel de administración"). Reception desks often have 1280 or 1366px screens; some staff may open the panel on a tablet.
- Shared UI lives in `components/ui/`; states already exist (`EmptyState`, `ErrorState`, `TableSkeleton`, toasts).
- Available tools: Sentry and PostHog (MCP servers are configured for this user; ask before creating projects or keys).

## Steps

1. **Responsive widths:** make every screen work from 1280px up (and check 1024px tablet landscape). Decide per screen with the user: collapse the sidebar to icons below a width, wrap filter bars, let wide tables scroll horizontally with a sticky first column, stack the side panels (Socios, Moderación, Turnos) under the main content, and cap the content width on very wide screens. If a layout needs a new design, propose it in Paper first.
2. **States:** every list and form has loading (Suspense fallbacks with skeletons), empty, error (`error.tsx` per route group with a retry), not-found (`not-found.tsx`), and a session-expired path back to `/ingresar`. Server action errors show inline, never a blank screen.
3. **Accessibility pass:** keyboard-only use of the agenda grid, menus, modals and drawers; focus return after closing a dialog; color contrast of muted text and badges; form errors linked to inputs; run axe on each page.
4. **Tests:** unit tests for domain logic (pricing, statuses, date helpers in Argentina time), and Playwright end-to-end tests for the main flows: sign in, create a booking, register a payment, cancel with and without refund, approve a fixed slot, hide a reported post, invite staff. Run them in CI against a seeded test database.
5. **Observability:** error tracking (Sentry) for server and client with source maps and the staff id (no personal data in events); product analytics (PostHog) for key actions only, with the user's consent on what's tracked; a health check endpoint.
6. **Security:** CSP and security headers (see `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`), rate limiting on auth and action endpoints, audit log of sensitive actions (refunds, blocks, role changes), dependency audit.
7. **Deploy:** pick the host with the user (Vercel, Firebase App Hosting or Cloud Run), with staging (`in-gorina-staging`) and production projects, env vars per environment, preview deployments for PRs, and a CI pipeline (typecheck, lint, tests, build). Custom domain (e.g. `panel.ingorina.com.ar`) and `robots: noindex` (already in metadata).
8. **Handover docs:** a short Spanish guide for staff (sign in, daily tasks) based on the "Ayuda del panel" page, and an ops README (deploy, rollback, rotating secrets, adding an admin).

## Done when

- Every screen is usable at 1280×720 and 1366×768 with no clipped content, checked with screenshots.
- The Playwright suite passes in CI on every PR.
- Errors show up in Sentry with useful context; staging and production deploy from CI.
- Lighthouse accessibility ≥ 95 on the main screens.

Report: what changed per area, screenshots at each width, CI and deploy setup, and open risks.
