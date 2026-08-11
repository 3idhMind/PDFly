import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Admin check, backed by a Firebase custom claim.
 *
 * The claim can only be set with the Admin SDK — a signed-in user cannot grant
 * it to themselves, and it is carried inside the signed ID token, so the server
 * re-verifies it on every request rather than trusting anything the client says.
 * This replaces the Supabase version, which round-tripped to a `bootstrap-admin`
 * edge function and then read a `user_roles` table on every auth change.
 *
 * This hook only decides whether to *render* admin UI. It is not a security
 * boundary — every admin API route must verify the same claim server-side.
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

    user
      .getIdTokenResult()
      .then((token) => {
        if (cancelled) return;
        setIsAdmin(token.claims.admin === true);
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
