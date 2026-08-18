import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * States, accurately, whether this deployment retains generated files.
 *
 * This used to be a permanent static warning: "files are not stored". That
 * was true when it was written and became false the day object storage was
 * actually wired up and verified working in production (D-024) — at which
 * point the notice was actively misleading a caller into saving files
 * urgently that were, in fact, sitting behind a working download link for an
 * hour. A notice that can silently go stale is worse than no notice, so this
 * now asks `/api/system` what is actually true right now, the same pattern
 * `ApiStatusBadge.tsx` uses for the same reason.
 *
 * Three real states, not two: while the check is in flight, showing neither
 * message is correct — a flash of "not stored" immediately followed by
 * "stored for an hour" reads as broken, worse than a brief blank moment. On a
 * network failure this assumes the more conservative case (not persisted),
 * since that is the safe assumption for someone deciding whether to save a
 * file right now.
 */
type State = "checking" | "persists" | "inline-only";

export const StorageNotice = ({ className = "" }: { className?: string }) => {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/system", { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body) => {
        if (cancelled) return;
        setState(body?.storage?.persists === true ? "persists" : "inline-only");
      })
      .catch(() => {
        if (!cancelled) setState("inline-only");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") return null;

  if (state === "persists") {
    return (
      <div
        className={`rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 ${className}`}
        role="note"
      >
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">
              Generated files are backed up for one hour
            </p>
            <p className="text-muted-foreground">
              Every response returns the finished file directly, and a copy is also kept for one
              hour behind a private, expiring download link on our own domain, in the response's
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">storage.download_url</code>
              field. After an hour, the link stops working and the file is permanently deleted.
            </p>
            <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
              <li>The link is never on a third-party domain, only ours.</li>
              <li>An hour is a backup window, not archival storage. Save anything you need later.</li>
              <li>
                Check <code className="rounded bg-muted px-1 py-0.5 text-xs">storage.persisted</code>{" "}
                on each response rather than assuming, since this can change if our storage
                provider is briefly unavailable, in which case the file still returns inline.
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 ${className}`}
      role="note"
    >
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-foreground">
            Generated files are returned inline and are not stored right now
          </p>
          <p className="text-muted-foreground">
            Every endpoint returns the finished file as base64 in the response body. Nothing is
            kept afterwards, so there is no download link to return to later. Save the file when
            you receive it; once the response is gone, the document has to be generated again.
          </p>
          <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
            <li>The API is fully functional. This affects retrieval, not generation.</li>
            <li>
              Responses are capped near 4.5&nbsp;MB. Larger batches fail at the platform rather
              than returning one of our error codes.
            </li>
            <li>Nothing you send is retained after the response is written.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
