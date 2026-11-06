/*
 * Public Firebase config (project in-gorina-staging, Web app). These values identify the
 * project and are safe in the browser; secrets live in FIREBASE_SERVICE_ACCOUNT (server only).
 * NEXT_PUBLIC_* values are inlined at build time, so set them before `pnpm build`.
 */

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** httpOnly cookie holding the Firebase session cookie. Read by proxy.ts and the session service. */
export const SESSION_COOKIE = "in_session";

/** Session length: staff sign in again after 5 days. */
export const SESSION_DAYS = 5;
