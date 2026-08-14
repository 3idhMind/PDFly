import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

/**
 * Admin check, decided by the server.
 *
 * Previously this read a Firebase custom claim (`token.claims.admin`). The
 * claim can only be set by an out-of-band Admin SDK call that nothing in this
 * project ever performed, so in practice the value was always false and the
 * admin UI was unreachable. The server now derives admin status from the
 * ADMIN_EMAIL environment variable, compared against the *Firebase-verified*
 * email inside the ID token.
 *
 * The address itself is never sent to the browser — `/api/me` returns only a
 * boolean. A `VITE_ADMIN_EMAIL` would have been simpler and would have shipped
 * the owner's email address to every visitor in the bundle.
 *
 * This hook decides whether to *render* admin UI. It is not a security
 * boundary: every admin API route re-verifies the same condition server-side,
 * so forcing this to true in devtools reveals an empty shell and nothing else.
 */
export const useIsAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    api
      .me()
      .then((data) => {
        if (cancelled) return;
        setIsAdmin(data.isAdmin === true);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isAdmin, loading };
};
