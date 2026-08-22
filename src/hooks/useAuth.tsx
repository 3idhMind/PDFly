/**
 * Single source of truth for auth state.
 *
 * Replaces six near-identical onAuthStateChange blocks that were copy-pasted
 * across Header, Settings, Analytics, Status, ApiPlayground and useIsAdmin —
 * each with its own listener, its own loading flag, and slightly different
 * behaviour. One listener, one state, consistent everywhere.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, getRedirectResult, type User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { ensureUserDocuments } from "@/lib/firebase/auth";

interface AuthState {
  user: User | null;
  /** True until the first auth state resolves. Guard redirects on this — */
  /** rendering a "signed out" view before Firebase has restored the session */
  /** causes a visible flash and, worse, spurious redirects to /auth. */
  loading: boolean;
  configured: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  configured: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    // Completes the Google redirect fallback (see signInWithGoogle). Harmless
    // no-op on a normal load. Failures here must not block the listener below.
    void getRedirectResult(auth).catch(() => undefined);

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      // Fire-and-forget: a Firestore hiccup should never block sign-in.
      if (u) void ensureUserDocuments(u).catch(() => undefined);
    });

    return unsub;
  }, []);

  const value = useMemo(
    () => ({ user, loading, configured: isFirebaseConfigured }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/*
 * Provider and hook in one file is the idiomatic React context shape, and
 * splitting them would leave a two-line module importing the context from here
 * anyway. The cost is that editing this file does a full reload instead of a
 * hot one during development, which is a fair trade for keeping the pairing
 * obvious. Disabled narrowly so the lint gate stays at zero and stays worth
 * reading.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
