# Phase 6 · Connect the mobile app to the real backend

## Goal

Switch the Expo app (`../in-app`) from its in-memory mocks to the backend built in Phase 3, feature by feature, so members and staff see the same data: bookings, fixed slots, open matches, the social portal, events, profile and history. The screens don't change; only each feature's `service.ts`.

## Project context

- Work in `../in-app`. Read its `AGENTS.md` (versioned Expo docs, `npx expo install`, lint + typecheck before done, never edit `ios/` or `android/`) and `docs/instructivo.md` section 9.
- Every feature has `src/features/<feature>/service.ts` with `isMockBackend = true`, plus `types.ts`, `mock-data.ts` and hooks; screens only call the service. Features: booking, fixed-slots, matches, social, home, profile, notifications, settings.
- Auth: React Native Firebase is already wired (`src/features/auth/`). The backend expects `Authorization: Bearer <Firebase ID token>`.
- The API: see the Phase 3 report and README in `in-web` for endpoints, error codes and the shared types. Load the `expo-data-fetching` skill before writing data-fetching code.

## Steps

1. A shared HTTP client: base URL from `EXPO_PUBLIC_API_URL` (per EAS environment, instructivo 9.1), the ID token on each request (refreshed when expired), timeouts, and mapping backend error codes to the app's Spanish messages.
2. Replace each feature's service with real calls behind the same functions and return types. Keep the mock path available (a flag), so screens can still be worked on without the backend.
3. Loading, error, empty and offline states: use the states the screens already have (e.g. the social feed's `cargando` / `vacio` / `error` scenarios) and the data-fetching approach the skill recommends (caching, refetch on focus, optimistic updates for joining a match or replying).
4. Account deletion (required by Apple): delete the Firebase user and the member's data through the backend.
5. Remove dev-only scenario switches from production builds, keep them in development.
6. Test on a development build against the staging backend: create a booking in the app and see it in the panel's Agenda; cancel it from the panel and see the app update.

## Done when

- No feature uses mock data in a production build; the mock flag still works in development.
- The end-to-end checks in step 6 pass on Android and iPhone.
- `npx expo lint`, `npx tsc --noEmit` and `npx expo-doctor` pass.

Report: features switched, any API gaps found (and whether they were fixed in the backend), and remaining issues.
