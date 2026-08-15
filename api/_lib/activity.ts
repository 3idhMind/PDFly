import { db, PRODUCT_ID } from "./firebase.js";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Server-side activity log.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * `src/lib/firebase/identity.ts` had a `logActivity` that only ever ran in the
 * browser, and only for account creation and product joins. Everything that
 * actually matters for an audit trail happens on the server and was recorded
 * nowhere: who minted an API key, when, under what name, when it was revoked,
 * when a blog post was published or deleted. The question "who created this
 * key and when" had no answer anywhere in the system.
 *
 * ── Where it goes ─────────────────────────────────────────────────────────
 * `users/{uid}/activity/{autoId}`, the same collection the client writes to, so
 * one account has one timeline rather than two half-timelines. Security rules
 * make it append-only for the owner and unreadable by anyone else; the Admin
 * SDK bypasses rules, which is how the admin console reads across accounts.
 *
 * ── What is recorded, and what is not ─────────────────────────────────────
 * The fact, the actor, the time, and a stable identifier for the thing acted
 * on. Never the raw API key, never file contents, never a request body. A log
 * that leaks the secret it is auditing is worse than no log.
 *
 * Never throws. An audit write that can break the operation it is auditing
 * turns a working key-creation into a 500.
 */

export type ServerActivityType =
  | "apikey.created"
  | "apikey.revoked"
  | "blog.published"
  | "blog.updated"
  | "blog.deleted"
  | "quota.exceeded"
  | "ratelimit.exceeded";

export interface ActivityActor {
  uid: string;
  /** How the caller authenticated. An API key acting is worth knowing about. */
  authType: "idToken" | "apiKey";
  /** Public prefix only, so a log entry can be tied to a key without exposing it. */
  keyPrefix?: string;
}

export async function logServerActivity(
  actor: ActivityActor,
  type: ServerActivityType,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db()
      .collection("users")
      .doc(actor.uid)
      .collection("activity")
      .add({
        type,
        productId: PRODUCT_ID,
        actorUid: actor.uid,
        authType: actor.authType,
        ...(actor.keyPrefix ? { keyPrefix: actor.keyPrefix } : {}),
        at: FieldValue.serverTimestamp(),
        source: "server",
        ...meta,
      });
  } catch (err) {
    // Log the failure, never propagate it.
    console.error(`[activity] could not record ${type}:`, (err as Error).name);
  }
}
