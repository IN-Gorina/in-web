# Phase 4 · Mercado Pago: deposits, refunds and reconciliation

## Goal

Members pay the booking deposit (seña) with Mercado Pago from the app; the backend confirms the booking when the payment is approved, releases the slot when it isn't paid in time, and refunds it when a cancellation qualifies. The panel's Pagos screen shows real Mercado Pago payments, statuses, operation ids and fees, and "Devolver la seña" triggers a real refund.

## Project context

- Phases 2 (Firebase Auth) and 3 (backend + database) are done. Read the Phase 3 README for where bookings and payments live and how the backend is deployed.
- Panel: `app/(panel)/pagos/`, `components/bookings/` (cancel dialog, cobro modal, drawer), `lib/data/payments/` and `lib/data/bookings/actions.ts`. Payment statuses already modeled: `acreditado`, `pendiente`, `vence-pronto`, `reintegrado`, `rechazado` (`lib/data/types.ts`).
- App: `../in-app/src/app/reserva/` has the payment screens designed in Paper (Payment / 01–02c: procesando, confirmada, rechazado, vencido, pendiente). Read `../in-app/docs/instructivo.md` 9.3: Mercado Pago credentials live **only** in the backend.
- Club rules (from Canchas y tarifas): fixed deposit amount, deposit deadline in minutes, refund if cancelled more than N hours before. Read them from the database, not constants.
- Use `ctx7` for current Mercado Pago docs (Checkout Pro vs Checkout Bricks / Payment API, webhooks with signature validation, refunds API, Argentina specifics). Don't rely on memory: the SDK and webhook signing change.

## Decide with the user first

- Checkout Pro (redirect) vs in-app Bricks/Payment API, given an Expo app: recommend one, considering how the app returns to the booking (deep link `ingorina://`) and how the Paper payment screens map to each state.
- Who pays the fees, and whether the deposit amount includes them (Pagos shows "Comisiones MP estimadas · costo del club").
- The seller account: the club's own Mercado Pago account, test and production credentials (the user creates them; give exact steps).

## Steps

1. Create the payment preference/intent on the backend when a booking needs a deposit; store the Mercado Pago id on the payment record with status `pendiente` and the expiry time.
2. Webhook endpoint: verify the signature, fetch the payment from the Mercado Pago API (never trust the webhook body alone), and make it idempotent. Approved → booking confirmed, deposit `pagada`, payment `acreditado`. Rejected or cancelled → payment `rechazado`, booking released. Record the operation id and fee.
3. Expiry: when the deadline passes without approval, release the booking (scheduled job or the mechanism chosen in Phase 3) and mark the payment. Handle a late approval arriving after release (refund automatically and notify).
4. Refunds: `cancelBooking({ refund: true })` and closed-day/blocked-court cancellations call the refunds API; store the refund as a negative payment (`reintegrado`) linked to the original. Only `senas.devolver` can refund manually; policy-based refunds (cancelled early enough) happen automatically from the app.
5. Panel: Pagos shows live statuses and real fees; the payment row menu links to the Mercado Pago operation; "Reenviar link de seña" creates a fresh payment link.
6. App: wire the deposit step to the chosen checkout and the Paper result screens; handle return, cancel and pending states.
7. Test mode end to end with Mercado Pago test users and cards, then a production checklist (credentials per environment, webhook URL, notification settings).

## Done when

- In test mode: book in the app → pay → the booking shows "Confirmada · seña" in the panel within seconds; rejected and expired cases release the slot; a refund from the panel shows "Reintegrado" and appears in Mercado Pago.
- Webhooks are verified and idempotent (replaying one changes nothing).
- No Mercado Pago secret is in the app or in `NEXT_PUBLIC_*`.
- Typecheck, lint, tests and build pass in both repos.

Report: checkout choice, flows covered, test evidence and the production checklist for the user.
