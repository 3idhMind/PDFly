/**
 * Auth operations. Every call the UI needs, in one place, with Firebase's
 * error codes translated into sentences a human can act on.
 *
 * Password reset uses Firebase's built-in email. No Brevo, no external SMTP —
 * Firebase handles this natively and adding a mail provider would be scope
 * nobody asked for.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updateProfile,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth } from "./client";
import { syncIdentity, logActivity } from "./identity";

/* ------------------------------------------------------------ error mapping */

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match. Check both and try again.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/user-disabled": "This account has been disabled. Contact support if that's unexpected.",
  "auth/user-not-found": "No account exists for that email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/email-already-in-use": "An account already exists with that email. Try signing in instead.",
  "auth/weak-password": "Password is too weak — use at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed": "Network problem — check your connection and try again.",
  "auth/popup-closed-by-user": "Sign-in window was closed before finishing.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups, or try again.",
  "auth/account-exists-with-different-credential":
    "You already have an account with this email using a different sign-in method.",
  "auth/expired-action-code": "That reset link has expired. Request a new one.",
  "auth/invalid-action-code": "That reset link is invalid or has already been used.",
  "auth/unauthorized-domain":
    "This domain isn't authorised in Firebase. Add it under Authentication → Settings → Authorized domains.",
  "auth/unauthorized-continue-uri":
    "That redirect URL isn't authorised in Firebase yet. The domain may still be verifying.",
  "auth/missing-email": "Enter the email address for your account.",
};

/** Never surface a raw Firebase error code to a user. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  const msg = (err as Error)?.message;
  return msg && !msg.startsWith("Firebase:") ? msg : "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------ user document */

/**
 * Thin wrapper so call sites read naturally. All the identity, auth-method and
 * product-membership logic — and the read/write throttling that keeps it cheap
 * — lives in identity.ts.
 *
 * Always called fire-and-forget from the sign-in paths below. Awaiting it was a
 * real bug: Firebase Auth had already created the account, the Firestore write
 * then failed, the throw propagated, and the user saw "signup failed" on a
 * signup that had actually succeeded — with a retry then telling them the email
 * was already in use. Account creation must never be gated on a profile write.
 */
export function ensureUserDocuments(user: User, opts: { force?: boolean } = {}): Promise<void> {
  return syncIdentity(user, opts);
}

const deferred = (e: unknown) =>
  console.warn("[auth] identity sync deferred:", (e as { code?: string })?.code);

/* ---------------------------------------------------------------- email/pass */

export async function signUpWithEmail(email: string, password: string, displayName?: string): Promise<User> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName?.trim()) {
    await updateProfile(user, { displayName: displayName.trim() }).catch(() => undefined);
  }
  void ensureUserDocuments(user, { force: true }).catch(deferred);
  return user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  void ensureUserDocuments(user, { force: true }).catch(deferred);
  return user;
}

/* -------------------------------------------------------------------- google */

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Popup first, redirect as a fallback.
 *
 * Popups are the better UX (the user never loses page state) but are blocked by
 * some mobile browsers and in-app webviews — a large slice of the Indian mobile
 * audience. Falling back to redirect rather than erroring keeps those users
 * able to sign in at all.
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const { user } = await signInWithPopup(auth, googleProvider);
    void ensureUserDocuments(user, { force: true }).catch(deferred);
    return user;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, googleProvider);
      return null; // page navigates away; result is picked up by the auth listener
    }
    throw err;
  }
}

/* ------------------------------------------------------------ password reset */

/**
 * Sends the reset email.
 *
 * The `url` is the "continue" link the user lands on afterwards. Firebase
 * rejects it with auth/unauthorized-continue-uri unless the domain is in
 * Authentication → Settings → Authorized domains, and custom-domain
 * verification can take a while to propagate.
 *
 * A continue URL is a nicety; being able to reset your password is not. So if
 * Firebase refuses the URL we retry without one — the email still sends and the
 * reset still works, the user just lands on Firebase's default page after.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: `${window.location.origin}/auth`,
      handleCodeInApp: false,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri") {
      console.warn("[auth] continue URL not authorised yet — sending reset without it");
      await sendPasswordResetEmail(auth, email);
      return;
    }
    throw err;
  }
}

/**
 * Validates the oobCode from the emailed link and returns the account's email.
 * Call this before showing the "set a new password" form — otherwise the user
 * fills in a form only to be told at submit time that the link expired.
 */
export function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode);
}

/** Completes a reset using the oobCode Firebase puts in the emailed link. */
export function completePasswordReset(oobCode: string, newPassword: string): Promise<void> {
  return confirmPasswordReset(auth, oobCode, newPassword);
}

/* -------------------------------------------------------------------- signout */

export async function signOut(): Promise<void> {
  // Logged before the sign-out, while we still have a uid to attach it to.
  const uid = auth.currentUser?.uid;
  if (uid) void logActivity(uid, "auth.signout");
  await fbSignOut(auth);
}

/** Fresh ID token for authenticating to our own API. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null;
}
