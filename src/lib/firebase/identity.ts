/**
 * Identity layer for the shared `idhtools` Firebase project.
 *
 * One account spans every 3idhMinds product. This module owns the user's
 * product-agnostic record: who they are, how they signed in, which products
 * they have joined, and in what order.
 *
 * ── Cost discipline (read this before adding anything) ────────────────────
 * Firebase bills per document read and write. `onAuthStateChanged` fires on
 * every page load, so anything done unconditionally here is multiplied by
 * pageviews across every product forever. Three rules follow from that:
 *
 *  1. A full sync costs 1 read + up to 3 writes, and is throttled to once per
 *     24h per device (see SYNC_TTL_MS). A returning visitor on their fifth
 *     page of the day costs zero.
 *  2. An explicit sign-in always syncs, throttle or not — that is when the
 *     auth-method and product data actually change.
 *  3. `productIds` is denormalised onto the user document. "Which products has
 *     this user joined, and which has he never touched?" is then ONE document
 *     read, not a subcollection listing that grows with every product we ship.
 *
 * ── Product isolation ─────────────────────────────────────────────────────
 * A product reads and writes only under `users/{uid}/products/{itsOwnId}/**`.
 * PDFly never touches the image tool's documents and vice versa, so one
 * product's traffic can never inflate another's bill or corrupt its data.
 *
 * NEVER add a `collectionGroup()` query over `products` or `usage`. It would
 * read across every user and every product at once — the single easiest way to
 * turn a cheap database into an expensive one. Aggregate server-side instead.
 */

import type { User } from "firebase/auth";
import { fs, getDb } from "./firestore";
import { PRODUCT_ID } from "./client";

/** Full sync at most once a day per device, unless a sign-in forces it. */
const SYNC_TTL_MS = 24 * 60 * 60 * 1000;
const SYNC_KEY = "_idh_sync";

export type AuthMethod = "password" | "google" | "unknown";

/** Firebase provider IDs → our stable, storable names. */
export function authMethodsOf(user: User): AuthMethod[] {
  const methods = new Set<AuthMethod>();
  for (const p of user.providerData) {
    if (p.providerId === "password") methods.add("password");
    else if (p.providerId === "google.com") methods.add("google");
  }
  // A user created before providerData was populated still signed in somehow.
  if (methods.size === 0) methods.add("unknown");
  return [...methods];
}

function shouldSync(uid: string): boolean {
  try {
    const raw = window.localStorage.getItem(`${SYNC_KEY}:${uid}`);
    return !raw || Date.now() - Number(raw) > SYNC_TTL_MS;
  } catch {
    return true; // storage unavailable — correctness beats thrift
  }
}

function markSynced(uid: string): void {
  try {
    window.localStorage.setItem(`${SYNC_KEY}:${uid}`, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export interface SyncOptions {
  /** True for an explicit sign-in/sign-up. Bypasses the throttle. */
  force?: boolean;
  /** Which product this session is running in. */
  productId?: string;
}

/**
 * Creates or refreshes the user's identity record and their membership of this
 * product. Safe to call on every auth event — the throttle makes repeat calls
 * free.
 *
 * Never throws. A failure here must not block signing in.
 */
export async function syncIdentity(user: User, opts: SyncOptions = {}): Promise<void> {
  try {
    await syncIdentityInner(user, opts);
  } catch (err) {
    // The docstring above promises this never throws, and sign-in genuinely must
    // not be gated on a profile write. But swallowing silently is how the
    // dotted-field-path bug stayed invisible for a whole release: Auth users
    // appeared, Firestore documents did not, and nothing anywhere said why.
    // Log the code loudly instead — permission-denied here means firestore.rules
    // and the payload written below have drifted apart.
    const code = (err as { code?: string })?.code ?? "unknown";
    console.error(
      `[identity] profile sync failed (${code}). The Auth account exists but its ` +
        `Firestore document was not written. If this is permission-denied, the ` +
        `payload no longer matches the hasOnly() allow-list in firestore.rules.`,
      err,
    );
  }
}

async function syncIdentityInner(user: User, opts: SyncOptions): Promise<void> {
  const productId = opts.productId ?? PRODUCT_ID;
  if (!opts.force && !shouldSync(user.uid)) return;

  const [m, db] = await Promise.all([fs(), getDb()]);
  const { doc, getDoc, setDoc, serverTimestamp, arrayUnion, increment } = m;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef); // the one read
  const existing = snap.exists() ? snap.data() : null;

  const methods = authMethodsOf(user);
  const isNewUser = !existing;
  const knownProducts: string[] = existing?.productIds ?? [];
  const isNewProductForUser = !knownProducts.includes(productId);

  // Per-method timestamps: linkedAt is written once, lastUsedAt every sync, so
  // we can answer "does this user use Google, email, or both — and since when".
  //
  // MUST be a nested object, NOT dotted keys like `authMethods.google.linkedAt`.
  // Dotted keys are field *paths* only in updateDoc(); setDoc() takes them
  // literally and creates a top-level field whose name contains dots. That made
  // request.resource.data.keys() contain "authMethods.google.linkedAt", which is
  // not in the hasOnly() allow-list in firestore.rules, so every create was
  // rejected with PERMISSION_DENIED — the Auth user existed and the Firestore
  // user document silently never appeared. setDoc({merge:true}) deep-merges
  // nested maps, so this form keeps the other provider's data intact.
  const authMethods: Record<string, Record<string, unknown>> = {};
  for (const method of methods) {
    authMethods[method] = { lastUsedAt: serverTimestamp() };
    if (!existing?.authMethods?.[method]?.linkedAt) {
      authMethods[method].linkedAt = serverTimestamp();
    }
  }

  await setDoc(
    userRef,
    {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      emailVerified: user.emailVerified,
      lastLoginAt: serverTimestamp(),
      lastAuthMethod: methods[0],
      authMethodList: methods, // flat array, cheap to filter on
      productIds: arrayUnion(productId),
      ...(isNewProductForUser ? { productCount: increment(1) } : {}),
      ...(isNewUser
        ? {
            createdAt: serverTimestamp(),
            firstProductId: productId, // the product that brought them in
            firstSeenAt: serverTimestamp(),
            globalSettings: {},
          }
        : {}),
      authMethods,
    },
    { merge: true },
  );

  if (isNewProductForUser) {
    const productRef = doc(db, "users", user.uid, "products", productId);
    await setDoc(
      productRef,
      {
        productId,
        joinedAt: serverTimestamp(),
        lastUsedAt: serverTimestamp(),
        // 1 for the product they signed up through, 2 for the next, and so on.
        // Stored rather than derived so ordering never needs a fan-out read.
        joinOrder: knownProducts.length + 1,
      },
      { merge: true },
    );
    await logActivity(user.uid, isNewUser ? "account.created" : "product.joined", { productId });
  }

  markSynced(user.uid);
}

/* ------------------------------------------------------------------ activity */

export type ActivityType =
  | "account.created"
  | "product.joined"
  | "auth.signin"
  | "auth.signout"
  | "auth.password_reset"
  | "apikey.created"
  | "apikey.revoked"
  | "consent.cloud_processing"
  | "consent.terms_accepted";

/**
 * Append-only activity log under the user.
 *
 * Kept per-user rather than in one global collection so a product only ever
 * reads its own user's history, and so deleting an account removes its trail
 * with it.
 *
 * Deliberately records *that* something happened, never file contents.
 * `consent.*` entries exist because an approval the user gave — accepting terms
 * or allowing a file to be processed in the cloud — needs a timestamped record
 * to be worth anything later.
 */
export async function logActivity(
  uid: string,
  type: ActivityType,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    const [{ collection, addDoc, serverTimestamp }, db] = await Promise.all([fs(), getDb()]);
    await addDoc(collection(db, "users", uid, "activity"), {
      type,
      productId: PRODUCT_ID,
      at: serverTimestamp(),
      ...meta,
    });
  } catch {
    // An audit trail that can break the app is worse than a gap in the trail.
  }
}
