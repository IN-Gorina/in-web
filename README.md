# IN Gorina · Panel del club

Admin panel for IN Padel & Social Club staff. Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind v4, pnpm. Club data still comes from the in-memory mock store (`lib/data/mock`); sign-in, roles and staff are real with Firebase Auth.

```bash
pnpm install
cp .env.example .env.local   # fill in, see below
pnpm dev                     # http://localhost:3000
```

Checks: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`.

## Modes

| `.env.local` | What happens |
|---|---|
| No `NEXT_PUBLIC_FIREBASE_*` | **Modo sin Firebase**: no login, a fixed mock user (Recepción; `MOCK_STAFF_ROLE=admin` for Administrador). The sidebar shows a "Modo sin Firebase" badge. |
| `NEXT_PUBLIC_FIREBASE_*` + service account | Real login with Firebase Auth (project `in-gorina-staging`, same as the mobile app). |

`NEXT_PUBLIC_*` values are inlined at build time: set them before `pnpm build`.

## Environment variables

| Variable | Secret | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | no | Web app config (step 1 below) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | no | Web app config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | no | Web app config (`in-gorina-staging`) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | no | Web app config |
| `FIREBASE_SERVICE_ACCOUNT` | **yes** | Service account JSON on one line (step 2). Or leave empty and set `GOOGLE_APPLICATION_CREDENTIALS` to the key file path. |
| `MOCK_STAFF_ROLE` | no | Mock mode only |

## Firebase setup (one time, in the console)

Use the club's Google account at [console.firebase.google.com](https://console.firebase.google.com/) → project **in-gorina-staging**.

1. **Register the Web app.** ⚙️ Project settings → General → Your apps → **Add app** → Web (`</>`). Nickname `IN Gorina Panel`, leave Firebase Hosting off → Register app. From the `firebaseConfig` shown, copy `apiKey`, `authDomain`, `projectId` and `appId` into the four `NEXT_PUBLIC_FIREBASE_*` variables.
2. **Service account key.** ⚙️ Project settings → Service accounts → **Generate new private key**. Put the JSON on one line in `.env.local` as `FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'` (e.g. `jq -c . key.json`), then delete the downloaded file or keep it in a password manager. Never commit it. If you already generated one for the app's push notifications (instructivo, section 8), you can reuse it.
3. **Sign-in methods.** Authentication → Sign-in method: Email/Password and Google are already enabled for the app; nothing to add.
4. **Authorized domains.** Authentication → Settings → Authorized domains: `localhost` is there by default. Add the panel's production domain when it has one (Google sign-in and the reset email link need it).
5. **Firestore.** Build → Firestore Database → **Create database** → Standard edition, location `southamerica-east1` (São Paulo), start in **production mode**. Then Rules tab → paste `firestore.rules` from this repo → Publish. Only the server (Admin SDK) reads and writes the `staff` collection.
6. **Email templates** are already in Spanish (instructivo 4.3). The password reset email is the same one the app uses.

## First administrador

Nobody can invite until there is an admin. With `.env.local` filled in:

```bash
pnpm tsx scripts/make-admin.ts correo@club.com "Nombre Apellido"
```

- If the account doesn't exist, it's created and the script prints a link to set the password.
- If it exists (e.g. a member of the app, or someone who already tried Google and saw "Sin acceso"), it gets the role; they sign in again.

From then on, administradores invite and manage staff from **Staff y permisos**.

## How auth works

- **Session:** the browser signs in with the Firebase JS SDK and posts the ID token to `POST /api/session`, which sets an httpOnly Firebase session cookie (`in_session`, 5 days, `sameSite=lax`, `secure` in production). Only a sign-in from the last 5 minutes is accepted. `DELETE /api/session` signs out.
- **Every request** goes through `getCurrentStaff()` (`lib/data/session/service.ts`): it verifies the cookie, rejects it if the user was disabled or their tokens revoked (e.g. password changed), and reads the `role` custom claim from the user record. No session → `/ingresar`; no role (a member of the app) → `/sin-acceso`. Pages, `PermissionGate` and `runAction` (server actions) all use it, and `lib/auth/permissions.ts` is the role → permission matrix.
- **`proxy.ts`** only redirects requests without a cookie to `/ingresar?next=…` so the panel doesn't flash; it doesn't authorize.
- **Roles** are the custom claim `{ role: "admin" | "recepcion" }`, set only by the server. Because the role is read on every request, a role change or removed access applies on the next page load.
- **Staff list:** Firestore `staff/{uid}` (name, email, role, status, invitedAt, lastSeen, pending invitation).
- **Invitations:** "Invitar al staff" creates the Firebase user without a password and shows a link to `/invitacion?token=…` to share (WhatsApp, email…). It is valid for 7 days and works once; only its hash is stored. Opening it lets the person set a password (or use the Google account of that email). If the email already has an account (e.g. from the app), the role is granted right away and there is no link.
- **Removing access** drops the role claim but doesn't disable the Firebase user, so a staff member who is also a member keeps using the app.
