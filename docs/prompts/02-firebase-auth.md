# Phase 2 · Connect the admin panel to Firebase Auth (Next.js 16)

## Goal

Replace the mock login and mock staff session of the IN Gorina admin panel with real **Firebase Authentication**, using the same Firebase project as the mobile app. When this is done, staff sign in with email + password (and Google), the panel knows who they are and which role they have, every page and server action checks that role on the server, and administrators can invite staff and change roles for real.

Out of scope: moving club data (bookings, payments, members…) off the mock store. That's Phase 3. The mock store keeps working as it is.

## Project context

- Repo: `in-web` (this folder). Next.js 16.4 with `cacheComponents` on, React 19.3, Tailwind v4, pnpm. Read `AGENTS.md` first: this Next.js version differs from older ones, so read the relevant guides in `node_modules/next/dist/docs/` before writing code. At least: `01-app/02-guides/authentication.md`, `authentication-with-cache-components.md`, `data-security.md`, `01-app/01-getting-started/16-proxy.md` and `03-api-reference/03-file-conventions/proxy.md` (Next 16 renamed `middleware` to `proxy`).
- Use the `ctx7` CLI for current Firebase docs (`firebase` JS SDK v11+ modular API, `firebase-admin`), per the user's global instructions.
- UI copy is Rioplatense Spanish ("Ingresá", "Revisá tu correo"). Code and comments in English.
- The sibling repo `../in-app` (Expo) already uses Firebase Auth through React Native Firebase with email/password, Google and Apple. Read `../in-app/docs/instructivo.md` (sections 4 and 9) and `../in-app/src/features/auth/` to stay consistent: same project, same providers, the Firebase UID is the member/staff id everywhere.
- Firebase project: **`in-gorina-staging`** (from `../in-app/google-services.json`). Only iOS and Android apps are registered; a **Web app** has to be added in the Firebase console. That's a manual step: tell the user exactly what to click and which values to paste into `.env.local`. `.env*` is already git-ignored.

### What exists today (read these files)

- `lib/data/session/service.ts`: `getCurrentStaff()` returns a fixed mock user (Recepción by default, `MOCK_STAFF_ROLE=admin` for Administrador). Every page and every server action goes through it.
- `lib/auth/permissions.ts`: roles `admin` | `recepcion` and the permission matrix (`can(role, permission)`), mirroring Paper "Panel / 13 – Staff y permisos". Keep this as the single source of truth.
- `lib/auth/guard.ts`: `runAction(permission, fn)` wraps every server action and calls `getCurrentStaff()`.
- `app/(auth)/`: login screens built from Paper "Panel / 00a–00e" (Ingresar, Recuperar contraseña, Revisá tu correo, Aceptar invitación, Sin acceso). `auth-form.tsx` only validates and navigates; each spot that needs Firebase has a `// Phase 2:` comment.
- `components/shell/account-menu.tsx`: "Cerrar sesión" just navigates to `/ingresar`.
- `app/(panel)/cuenta/account-forms.tsx`: change password is mocked.
- `lib/data/staff/actions.ts`: invite, change role, reset password, revoke access. Mocked, with `Phase 2` notes.
- `components/shell/permission-gate.tsx` and the nav filter in `components/shell/sidebar.tsx` hide admin-only sections.

## Design decisions (propose, then confirm with the user before building)

1. **Session:** Firebase **session cookies** (`createSessionCookie` / `verifySessionCookie` in `firebase-admin`), httpOnly + secure + sameSite=lax, set by a route handler after the client signs in with the JS SDK and posts the ID token. Recommended over client-only auth because pages are server-rendered and server actions must authorize. Expiry: 5 days, with re-login after that.
2. **Roles:** Firebase **custom claims** `{ role: "admin" | "recepcion" }` set only with `firebase-admin`. A user without a role is a member of the app, not staff: they go to `/sin-acceso`. Remember claims only refresh on a new ID token; after changing a role, revoke that user's refresh tokens so the change applies.
3. **Staff list:** where to store staff profile data (name, status, invitedAt, lastSeen). Firebase Auth alone can't list "invited but not accepted". Options: a Firestore `staff` collection, or the Phase 3 database. Recommend a small `staff` collection in Firestore now (Admin SDK only, client access denied by rules) unless the user has already chosen the Phase 3 database.
4. **Invitations:** create the user with `firebase-admin` (no password), store a pending invite, email a link to `/invitacion?token=…`. The page sets the password via a server route that verifies the token. Email sending: Firebase's built-in templates only cover password reset and email verification, so either use `generatePasswordResetLink` as the invite link (simplest: the invite *is* a "set your password" link) or a transactional email provider. Recommend `generatePasswordResetLink` + a custom action URL pointing to `/invitacion`, so no email provider is needed yet. Note that this still needs the email to be delivered: ask the user how they want to send it (Firebase's own email via an email-link flow, or a provider like Resend). Invites expire in 7 days (Paper copy).
5. **Google sign-in:** allowed only for emails that already have a staff role (same project, so a member's Google account must land on `/sin-acceso`).

## Steps

1. Read the files above and the Next.js guides. Write a short plan (files to add or change, env vars, manual console steps) and confirm the decisions with the user.
2. Add `firebase` (client) and `firebase-admin` (server) with pnpm. Create:
   - `lib/firebase/client.ts`: lazily initialized app + auth from `NEXT_PUBLIC_FIREBASE_*` env vars.
   - `lib/firebase/admin.ts` (`server-only`): Admin app from a service account (`FIREBASE_SERVICE_ACCOUNT` JSON in env, or `GOOGLE_APPLICATION_CREDENTIALS`). Never commit the key; `.env.example` lists the variable names with empty values.
3. Session:
   - `app/api/session/route.ts`: POST exchanges an ID token for the session cookie (check `auth_time` is recent), DELETE clears it and revokes refresh tokens.
   - Replace `getCurrentStaff()` with a real implementation that reads and verifies the cookie (`checkRevoked: true`), reads the role claim and returns the staff member. Keep its signature, so pages and actions don't change. Wrap it in React `cache()` so one request verifies once. Under `cacheComponents`, reading cookies is dynamic: follow `authentication-with-cache-components.md` (Suspense boundaries, no `"use cache"` on user-specific data).
   - If there's no valid session, `app/(panel)/layout.tsx` redirects to `/ingresar?next=…`. Staff without a role go to `/sin-acceso`.
   - `proxy.ts`: optimistic redirect only (cookie present or not) to avoid flashing panel UI; the real check stays in the server code (the docs warn against relying on proxy alone).
4. Wire the login screens in `app/(auth)/auth-form.tsx`, replacing each `// Phase 2:` comment:
   - Ingresar: `signInWithEmailAndPassword` → POST `/api/session` → `router.replace(next ?? "/")`. Map Firebase errors to the Spanish messages the mobile app uses (`../in-app/src/features/auth/errors.ts`), e.g. wrong password → "El correo o la contraseña no coinciden".
   - Google: `signInWithPopup` with `GoogleAuthProvider`, then the same session exchange. No staff role → `/sin-acceso`.
   - Recuperar: `sendPasswordResetEmail` with an action URL back to the panel. Email templates are already set to Spanish in the console (instructivo 4.3).
   - Aceptar invitación: verify the token server-side, set the password, sign in.
   - Sin acceso and "Cerrar sesión" (account menu): sign out client-side + DELETE `/api/session`.
   - Mi cuenta → Cambiar contraseña: `reauthenticateWithCredential` + `updatePassword`.
5. Staff actions (`lib/data/staff/actions.ts`): invite, change role (set claim + revoke tokens), revoke access (disable user + revoke tokens), restore access, send password reset. Keep the existing guards (`staff.gestionar`, can't change or revoke yourself, at least one admin). Read the staff list from the chosen store instead of the mock.
6. Bootstrap: a one-off script (`scripts/make-admin.ts`, run with `pnpm tsx`) that gives the first account the `admin` claim, since nobody can invite before there's an admin. Document it in the README.
7. Keep a local dev mode: when the `NEXT_PUBLIC_FIREBASE_*` vars are missing, keep today's mock session (with `MOCK_STAFF_ROLE`) and show a small "Modo sin Firebase" badge in the sidebar. This matches what the mobile app does (instructivo section 7).
8. Security review: every server action and route handler authorizes on the server; no secrets in `NEXT_PUBLIC_*`; cookies httpOnly/secure; no open redirect (validate `next` is a local path); errors don't leak whether an email exists.

## Done when

- Fresh browser → `/agenda` redirects to `/ingresar`. Signing in as an admin shows all sections; as Recepción, admin sections are hidden and their URLs show the "solo para administradores" state; server actions refuse with the same message.
- Wrong password, unknown email and disabled user each show a Spanish message; a member account (no role) lands on `/sin-acceso`.
- Inviting someone creates the user and a working link; accepting sets the password and signs in. Changing a role applies on the next request; revoking access logs that person out.
- Password reset email arrives in Spanish and the link works. "Cerrar sesión" clears the session on the server.
- Without Firebase env vars, the panel still runs in mock mode.
- `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm build` pass. README documents the env vars, the console steps and the admin bootstrap script.

Report: what was done, the exact manual steps the user still has to do in the Firebase console, and any deviation from this plan.
