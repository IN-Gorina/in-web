# IN Gorina · Panel del club

Admin panel for IN Padel & Social Club staff. Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind v4, pnpm. Club data comes from in-api's Postgres (Supabase), read and written by the panel's own server code as the `in_web_panel` role; sign-in, roles and staff are Firebase Auth.

```bash
pnpm install
cp .env.example .env.local   # fill in, see below
pnpm dev                     # http://localhost:3000
```

Checks: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`.

## Data: in-api's database, no API in between

There is no separate admin API. `lib/data/<feature>/service.ts` (reads) and `actions.ts` (server
actions) query in-api's Postgres with `postgres` (`lib/db/sql.ts`) as the role `in_web_panel`
(in-api migration 0024): it reads what the panel shows and writes only what its actions change.

Effects stay in in-api: an action changes the state and, in the same transaction, inserts the
domain event in `app.outbox_events` (`lib/db/outbox.ts`, `lib/data/writes.ts`) with the same topic
and payload in-api's own services use. in-api's relay then notifies the member, refunds the deposit,
refreshes availability or reloads the club. Every action also writes `app.audit_log` with the staff
member in `metadata.panel`.

| Panel can | Mirrors in-api |
|---|---|
| Cancel a booking (refunding the deposit or not) | `OccupancyService.cancel` → `booking.cancelled` |
| Block courts / close the club on some days (cancels the bookings there, refunded) | `club_closures` + `club.config.changed` |
| Approve, reject or end a fixed slot | `FixedSlotsService.decide` → `fixed_slot.decided` (in-api books the weeks every 5 min) |
| Enable or disable a court | `club_courts.active` + `club.config.changed` |
| Hide or restore a post, dismiss its reports | `posts.status`; dismissals in `audit_log` |
| Block or unblock a member, set their category | `users.status`, `users.category` |

Creating bookings, members, events, payments at the club, notes and push campaigns, and editing
rates or hours, aren't available yet: those actions answer "Esto todavía no se puede hacer desde el
panel." Rates, hours and new courts still come from in-api's `club.yaml` (applied when the club is
created, or with `pnpm seed --club`).

`NEXT_PUBLIC_*` values are inlined at build time: set them before `pnpm build`.

## Environment variables

| Variable | Secret | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | no | Web app config (step 1 below) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | no | Web app config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | no | Web app config (`in-gorina-staging`) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | no | Web app config |
| `FIREBASE_SERVICE_ACCOUNT` | **yes** | Service account JSON on one line (step 2). Or leave empty and set `GOOGLE_APPLICATION_CREDENTIALS` to the key file path. |
| `DATABASE_URL` | **yes** | in-api's Postgres as `in_web_panel`: Supavisor session mode, port 5432, user `in_web_panel.<project-ref>` (password set with `alter role in_web_panel with login password '…'`, see in-api `docs/deploy`) |

## Firebase setup (one time, in the console)

Use the club's Google account at [console.firebase.google.com](https://console.firebase.google.com/) → project **in-gorina-staging**.

1. **Register the Web app.** ⚙️ Project settings → General → Your apps → **Add app** → Web (`</>`). Nickname `IN Gorina Panel`, leave Firebase Hosting off → Register app. From the `firebaseConfig` shown, copy `apiKey`, `authDomain`, `projectId` and `appId` into the four `NEXT_PUBLIC_FIREBASE_*` variables.
2. **Service account key.** ⚙️ Project settings → Service accounts → **Generate new private key**. Put the JSON on one line in `.env.local` as `FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'` (e.g. `jq -c . key.json`), then delete the downloaded file or keep it in a password manager. Never commit it. If you already generated one for the app's push notifications (instructivo, section 8), you can reuse it.
3. **Sign-in methods.** Authentication → Sign-in method: Email/Password and Google are already enabled for the app; nothing to add.
4. **Authorized domains.** Authentication → Settings → Authorized domains: `localhost` is there by default. Add the panel's production domain when it has one (Google sign-in and the reset email link need it).
5. **Firestore.** Build → Firestore Database → **Create database** → Standard edition, location `southamerica-east1` (São Paulo), start in **production mode**. Then Rules tab → paste `firestore.rules` from this repo → Publish. Only the server (Admin SDK) reads and writes the `staff` collection.
6. **Email templates** are already in Spanish (instructivo 4.3). The password reset email is the same one the app uses.

## Superadministrador

There is a single superadministrador: it can do everything, including **Staff y permisos**.
Everyone it invites is an administrador (turnos, canchas, socios, moderación). With `.env.local`
filled in:

```bash
pnpm tsx scripts/make-superadmin.ts correo@club.com "Nombre Apellido"
pnpm tsx scripts/make-superadmin.ts otro@club.com --transferir   # the current one becomes administrador
```

- If the account doesn't exist, it's created and the script prints a link to set the password.
- If it exists (e.g. a member of the app, or someone who already tried Google and saw "Sin acceso"), it gets the role; they sign in again.
- Nobody can change or remove the superadministrador from the panel.

## How auth works

- **Session:** the browser signs in with the Firebase JS SDK and posts the ID token to `POST /api/session`, which sets an httpOnly Firebase session cookie (`in_session`, 5 days, `sameSite=lax`, `secure` in production). Only a sign-in from the last 5 minutes is accepted. `DELETE /api/session` signs out.
- **Every request** goes through `getCurrentStaff()` (`lib/data/session/service.ts`): it verifies the cookie, rejects it if the user was disabled or their tokens revoked (e.g. password changed), and reads the `staff_role` custom claim from the user record. No session → `/ingresar`; no role (a member of the app) → `/sin-acceso`. Pages, `PermissionGate` and `runAction` (server actions) all use it, and `lib/auth/permissions.ts` is the role → permission matrix.
- **`proxy.ts`** only redirects requests without a cookie to `/ingresar?next=…` so the panel doesn't flash; it doesn't authorize.
- **Roles** are the custom claim `{ staff_role: "superadmin" | "admin" }`, set only by the server. Not `role`: the same Firebase project holds the app's members, whose `role: "authenticated"` (with `app_user_id`) Supabase Realtime needs; in-api adds its claims without removing the panel's. Because the role is read on every request, a role change or removed access applies on the next page load.
- **Staff list:** Firestore `staff/{uid}` (name, email, role, status, invitedAt, lastSeen, pending invitation).
- **Invitations:** "Invitar al staff" creates the Firebase user without a password and shows a link to `/invitacion?token=…` to share (WhatsApp, email…). It is valid for 7 days and works once; only its hash is stored. Opening it lets the person set a password (or use the Google account of that email). If the email already has an account (e.g. from the app), the role is granted right away and there is no link.
- **Removing access** drops the role claim but doesn't disable the Firebase user, so a staff member who is also a member keeps using the app.
