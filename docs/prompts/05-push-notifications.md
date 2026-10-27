# Phase 5 · Push notifications (panel → app)

## Goal

Notifications written in the panel reach members' phones: sent now or scheduled, to everyone, a category, followers of a portal topic, or fixed-slot holders, opening the chosen screen when tapped. The automatic notifications the product promises (deposit expiring, booking cancelled by the club, fixed slot approved or rejected, freed court, event published) are sent by the backend.

## Project context

- Phases 2–3 are done (and 4 if deposit notifications are included).
- Panel: `app/(panel)/notificaciones/` (composer, schedule popover, sent list) and `lib/data/notifications/` (store only today). Audiences and targets are defined there; the audience sizes come from a mock (`getAudienceSizes`).
- App: `../in-app/docs/instructivo.md` section 8 (FCM V1 key uploaded to EAS, APNs key from EAS) and the "Código pendiente" note: the app must register its Expo push token with the backend at sign-in and handle taps to open the right screen. Paper designs: "Push / 01–04" on the App · Flujos page. Notification preferences already exist in the app (`src/features/settings/`).
- Use `ctx7` / the Expo docs for the current `expo-notifications` and Expo Push API (or FCM directly, if decided). The app is on Expo SDK 57.

## Decide with the user first

- Expo Push Service (simplest with EAS credentials already set) vs sending through FCM/APNs directly. Recommend Expo Push unless there's a reason not to.
- How scheduled sends run (a scheduled job in the Phase 3 backend, Cloud Scheduler, or a queue).

## Steps

1. Backend: store device tokens per member (several devices, opt-out flags, invalid-token cleanup from push receipts).
2. App: request permission (already done), get the Expo push token, POST it after sign-in and on token change, delete it on sign-out; handle the tap → deep link to the target (Inicio, Reservar, Social › Partidos, an event, a portal post).
3. Audience resolution on the backend: count and list recipients for each audience type, respecting each member's notification preferences. The panel's "N socios con notificaciones activas" uses the real count.
4. Send now and scheduled: batch, retry and record results (recipients, failures). Opens come from the app reporting the tap (that's the "46% la abrió" in the sent list).
5. Automatic notifications fired by backend events (list them and confirm with the user), each with Spanish copy following the app's voice.
6. Panel: sent list shows real numbers; scheduled ones can be cancelled (already in the UI).

## Done when

- A notification sent from the panel arrives on a real Android and iPhone development build and opens the chosen screen.
- Scheduling for a time 2 minutes ahead delivers at that time; cancelling before that prevents it.
- Members with notifications off don't receive anything; invalid tokens get removed.
- Typecheck, lint, tests and builds pass in both repos.

Report: delivery path, the automatic notifications implemented, and how to test on devices.
