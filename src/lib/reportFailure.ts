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
    await fetch("/api/report-issue", {
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

let installed = false;

/** Installs global handlers for uncaught errors and promise rejections. */
export function installFailureReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    reportFailure({
      message: e.message || "Uncaught error",
      stack: e.error?.stack,
      type: "uncaught_error",
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    reportFailure({
      message: typeof reason === "string" ? reason : reason?.message || "Unhandled rejection",
      stack: reason?.stack,
      type: "unhandled_rejection",
    });
  });
}
