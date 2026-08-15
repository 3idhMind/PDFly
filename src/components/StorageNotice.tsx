import { AlertCircle } from "lucide-react";

/**
 * States plainly that API responses are not persisted yet.
 *
 * The API works and returns a real, complete PDF. What it does not do is keep
 * it: the file exists only inside the HTTP response, so a caller that does not
 * save it has nothing to come back to. That is a genuine limitation and it
 * belongs on the page where someone decides whether to build against this,
 * not in a changelog they will never read.
 *
 * Wording is deliberately specific about what does and does not happen. "Beta"
 * or "coming soon" would let a reader assume their files are stored somewhere
 * and merely hard to reach, which is the opposite of the truth.
 */
export const StorageNotice = ({ className = "" }: { className?: string }) => (
  <div
    className={`rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 ${className}`}
    role="note"
  >
    <div className="flex gap-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-foreground">
          Generated files are returned inline and are not stored
        </p>
        <p className="text-muted-foreground">
          Every endpoint returns the finished file as base64 in the response body. We keep no
          copy, so there is no download URL to return to later. Save the file when you receive
          it; once the response is gone, the document has to be generated again.
        </p>
        <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
          <li>The API is fully functional. This affects retrieval, not generation.</li>
          <li>
            Responses are capped at roughly 3&nbsp;MB of output. Larger batches fail at the
            platform rather than returning one of our error codes.
          </li>
          <li>Nothing you send is retained after the response is written.</li>
        </ul>
        <p className="text-muted-foreground">
          Object storage is in progress. Once it lands, responses will carry a short-lived
          signed download URL instead of inline data, which also removes the size limit. No
          request or response format you rely on today will change.
        </p>
      </div>
    </div>
  </div>
);
