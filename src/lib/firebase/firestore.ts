/**
 * Lazily-loaded Firestore.
 *
 * The Firestore SDK is ~124 kB gzipped. Only three screens touch it — Settings,
 * Analytics, and the landing-page feedback form — plus the one profile write
 * after sign-in. Statically importing it from `client.ts` put all of that in
 * the entry bundle for every visitor, including someone who lands on `/` to
 * read the homepage. See _internal/BASELINE-PERF.md.
 *
 * Both the module and the instance are cached, so the dynamic import resolves
 * from memory on every call after the first.
 */

import { firebaseApp } from "./client";

type FirestoreModule = typeof import("firebase/firestore");

let modulePromise: Promise<FirestoreModule> | null = null;

/** The Firestore SDK namespace: `const { doc, getDoc } = await fs();` */
export function fs(): Promise<FirestoreModule> {
  if (!modulePromise) modulePromise = import("firebase/firestore");
  return modulePromise;
}

let dbPromise: Promise<ReturnType<FirestoreModule["getFirestore"]>> | null = null;

export function getDb() {
  if (!dbPromise) dbPromise = fs().then((m) => m.getFirestore(firebaseApp));
  return dbPromise;
}
