import { Wrench } from "lucide-react";

/**
 * Temporary notice while the REST API is being finished.
 *
 * The date is a hardcoded constant, not `new Date()`, deliberately. A notice
 * that always says "as of today" is always stale and never says anything — the
 * whole point is that the reader can see how old the promise is and judge it.
 * If this date starts looking embarrassing, that is the notice working.
 *
 * DELETE THIS COMPONENT and its two usages (Settings, ApiPlayground) the day
 * the API goes live. Do not leave it behind "just in case".
 */
const POSTED = "9 August 2026";

export const ApiMaintenanceNotice = ({ className = "" }: { className?: string }) => (
  <div
    className={`rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 ${className}`}
    role="status"
  >
    <div className="flex items-start gap-3">
      <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-medium text-foreground">
          The REST API is in maintenance while we finish it
        </p>
        <p className="text-muted-foreground mt-1 leading-relaxed">
          As of <span className="font-medium text-foreground">{POSTED}</span>, API requests are not
          being served. We expect it live within two business days, during business hours. You can
          still create and manage keys — they'll work the moment it's up.
        </p>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          Every PDF tool on the site is unaffected — those run entirely in your browser and never
          touched the API. Sorry for the inconvenience.
        </p>
      </div>
    </div>
  </div>
);
