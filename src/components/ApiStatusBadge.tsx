import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

/**
 * Live API status, small enough to sit in a footer or at the bottom of a page.
 *
 * Calls the real `/api/system` probe, which independently checks Firestore and
 * Firebase Auth and always answers 200 with the verdict in the body. That
 * matters here: a status widget that goes blank when the API is down is worse
 * than no widget, because "nothing rendered" and "everything is fine" look
 * identical to a visitor.
 *
 * A network failure is therefore reported as "unreachable", not hidden. The
 * whole point is that someone can look at the page and know whether the server
 * is actually running.
 */
type State = "checking" | "operational" | "degraded" | "unreachable";

const LOOK: Record<State, { dot: string; text: string; label: string }> = {
  checking: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", label: "Checking status" },
  operational: { dot: "bg-emerald-500", text: "text-muted-foreground", label: "API operational" },
  degraded: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-500", label: "API degraded" },
  unreachable: { dot: "bg-red-500", text: "text-red-600 dark:text-red-500", label: "API unreachable" },
};

export const ApiStatusBadge = ({ className = "" }: { className?: string }) => {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/system", { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body) => {
        if (cancelled) return;
        setState(body?.status === "operational" ? "operational" : "degraded");
      })
      .catch(() => {
        if (!cancelled) setState("unreachable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const look = LOOK[state];

  return (
    <Link
      to="/status"
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm transition-colors hover:border-primary hover:bg-accent ${className}`}
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {state === "operational" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${look.dot}`} />
      </span>
      <span className={look.text}>{look.label}</span>
      <Activity className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
    </Link>
  );
};
