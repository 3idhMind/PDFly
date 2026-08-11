/**
 * Firebase client initialisation.
 *
 * Project: "idhtools" — deliberately generic. It is the shared identity layer
 * for every 3idhMinds tool, not a PDFly-specific project. A user who signs up
 * for PDFly is already signed up for whatever ships next.
 *
 * Every value here is VITE_-prefixed and therefore compiled into the browser
 * bundle. That is correct and expected: Firebase web config is a set of public
 * identifiers, not credentials. Access control comes from Firestore Security
 * Rules and Firebase Auth — never from hiding these strings.
 */

import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * True when the app has enough config to talk to Firebase at all.
 *
 * This exists because of a real failure we hit: the Supabase client called
 * createClient() at module scope, which throws on a missing URL, which
 * white-screened the entire site the moment an env var was absent. A missing
 * env var should degrade one feature, not kill the app. Callers check this
 * flag instead of assuming.
 */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

if (!isFirebaseConfigured && import.meta.env.DEV) {
  console.warn(
    "[firebase] Config incomplete — auth and Firestore are disabled. " +
      "Check VITE_FIREBASE_API_KEY / _PROJECT_ID / _APP_ID in .env",
  );
}

// getApps() guard keeps Vite HMR from re-initialising on every hot reload.
export const firebaseApp = getApps().length ? getApp() : initializeApp(config);

export const auth = getAuth(firebaseApp);

/**
 * Firestore is loaded lazily — see lib/firebase/firestore.ts.
 *
 * Importing it here statically cost 124 kB gzipped in the entry bundle, on
 * every page load, for a dependency only three screens actually use. Auth has
 * to be eager because the header renders sign-in state everywhere; Firestore
 * does not.
 */

// Survive a refresh and a closed tab. Matches the previous Supabase behaviour
// (persistSession: true) so users are not silently logged out by the migration.
void setPersistence(auth, browserLocalPersistence).catch(() => {
  /* Safari private mode and similar — fall back to in-memory, don't crash. */
});

/** Product namespace under users/{uid}/products/{productId}. */
export const PRODUCT_ID = "pdfly";
