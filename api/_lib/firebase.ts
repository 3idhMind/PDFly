/**
 * Firebase Admin, server side only.
 *
 * Nothing in this directory is ever bundled into the browser — Vercel builds
 * `api/` as separate serverless functions. The private key here bypasses every
 * Firestore security rule, so it must never be imported from `src/`.
 */

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

function credentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    );
  }

  // The key is a multi-line PEM. Env vars are single-line, so it is stored with
  // literal "\n" sequences — restore them. Surrounding quotes get stripped too,
  // because some dashboards add them and some don't.
  privateKey = privateKey.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");

  return { projectId, clientEmail, privateKey };
}

let cached: App | null = null;

export function adminApp(): App {
  if (cached) return cached;
  cached = getApps().length ? getApp() : initializeApp({ credential: cert(credentials()) });
  return cached;
}

export function db(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

/** Product namespace. Mirrors PRODUCT_ID in src/lib/firebase/client.ts. */
export const PRODUCT_ID = "pdfly";

/** Free tier, configurable so raising it is an env change rather than a deploy. */
export const FREE_TIER_MONTHLY_QUOTA = Number(process.env.PDFLY_FREE_TIER_MONTHLY_QUOTA ?? 100);

/** Default API rate limit, requests per minute per key. */
export const DEFAULT_RATE_LIMIT_PER_MIN = Number(process.env.PDFLY_RATE_LIMIT_PER_MIN ?? 60);
