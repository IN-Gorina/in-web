import "server-only";

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { firebaseConfig } from "./config";

/*
 * Firebase Admin, server only. Credentials come from FIREBASE_SERVICE_ACCOUNT (the service
 * account JSON on one line) or, if that is empty, GOOGLE_APPLICATION_CREDENTIALS.
 */

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({
    credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());
