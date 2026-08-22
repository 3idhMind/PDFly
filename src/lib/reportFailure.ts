/**
 * Reports an application failure to our own API. Never throws and never sends
 * file contents. `keepalive` so a report survives the page being closed —
 * which is exactly when the worst crashes happen.
 */
export async function reportFailure(input: {
  message: string;
  tool?: string;
  stack?: string;
  severity?: "info" | "warning" | "critical";
  type?: string;
}) {
  try {
    await fetch("/api/system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        message: input.message,
        tool: input.tool,
        stack: input.stack,
        severity: input.severity ?? "critical",
        type: input.type ?? "client_failure",
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    });
  } catch {
    // Reporting must never break the app.
  }
}

/* ------------------------------------------------------------ classification */

/**
 * A lazy route chunk that 404s.
 *
 * This is what a visitor gets when they had the site open, we deployed, and the
 * hashed filename they were about to request no longer exists. It is not a code
 * defect and there is nothing to debug — the fix is to load the new build. It
 * was showing up as `critical` in the dashboard, which made a routine deploy
 * look like an outage and buried the reports that do need attention.
 */
const STALE_CHUNK =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;

/**
 * Firebase's IndexedDB layer rejects with this when the tab is hidden, frozen
 * or closed mid-write, and when a second tab takes the persistence lease. It is
 * internal noise from a library doing the right thing, not a failure of ours.
 */
const BENIGN_NOISE = /Database is closing|Database is hidden|IndexedDB.*closed|The user aborted a request|AbortError/i;

const RELOAD_GUARD = "_pdfly_stale_reload";

function severityFor(message: string): "info" | "warning" | "critical" {
  if (STALE_CHUNK.test(message)) return "info";
  if (BENIGN_NOISE.test(message)) return "info";
  return "critical";
}

/**
 * Loads the new build once when a chunk goes missing.
 *
 * Guarded through sessionStorage rather than a module variable: the whole point
 * is that the page reloads, so anything held in memory is gone by the time we
 * would need to check it. Without the guard a genuinely broken deploy would put
 * the tab in a reload loop, which is worse than the blank route it replaces.
 */
function recoverFromStaleChunk(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(RELOAD_GUARD)) return;
    sessionStorage.setItem(RELOAD_GUARD, "1");
    window.location.reload();
  } catch {
    /* storage unavailable — better to leave the page than risk a loop */
  }
}

/** Called once on a successful load, so the next stale chunk may reload again. */
function clearReloadGuard(): void {
  try {
    sessionStorage.removeItem(RELOAD_GUARD);
  } catch {
    /* ignore */
  }
}

let installed = false;

/** Installs global handlers for uncaught errors and promise rejections. */
export function installFailureReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Reaching here means the current build loaded, so a previous stale-chunk
  // reload succeeded and the guard has done its job.
  clearReloadGuard();

  const handle = (message: string, stack: string | undefined, type: string) => {
    const severity = severityFor(message);
    void reportFailure({ message, stack, type, severity });
    if (STALE_CHUNK.test(message)) recoverFromStaleChunk();
  };

  window.addEventListener("error", (e) => {
    handle(e.message || "Uncaught error", e.error?.stack, "uncaught_error");
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const message = typeof reason === "string" ? reason : reason?.message || "Unhandled rejection";
    handle(message, reason?.stack, "unhandled_rejection");
  });
}
