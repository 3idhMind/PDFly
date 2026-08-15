import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getIdToken } from "@/lib/firebase/auth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Activity, AlertTriangle, Clock, RefreshCw, Bug } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: any;
  created_at: string;
}

interface ApiLog {
  id: string;
  request_id: string;
  endpoint: string;
  method: string;
  status_code: number | null;
  latency_ms: number | null;
  ip_address: string | null;
  error: string | null;
  created_at: string;
}

const severityColor = (s: string) =>
  s === "critical" ? "destructive" : s === "warning" ? "default" : "secondary";

const FAILURE_TYPES = ["client_failure", "uncaught_error", "unhandled_rejection", "endpoint_error"];

export default function AdminSecurity() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setDataLoading(true);
    setLoadError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/events", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? `Failed to load (${res.status})`);
      setEvents(body.events ?? []);
      setLogs(body.logs ?? []);
    } catch (err) {
      setLoadError((err as Error).message || "Failed to load data");
    } finally {
      setLastRefresh(new Date());
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) { navigate("/"); return; }
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [isAdmin, loading, navigate, load]);

  if (loading || isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Verifying admin access…</div>;
  }
  if (!isAdmin) return null;

  const failures = events.filter((e) => FAILURE_TYPES.includes(e.event_type));
  const otherEvents = events.filter((e) => !FAILURE_TYPES.includes(e.event_type));
  const slowRequests = logs.filter((l) => (l.latency_ms ?? 0) > 3000).length;
  const errors = logs.filter((l) => (l.status_code ?? 0) >= 500).length;
  const rateLimited = events.filter((e) => e.event_type === "rate_limited").length;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin Security · PDFly" description="Internal admin security dashboard" />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-destructive/10">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Security & Tracing</h1>
              <p className="text-sm text-muted-foreground">Failure reports, request traces, and anomaly signals</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">Updated {lastRefresh.toLocaleTimeString()}</span>
            )}
            <Button variant="outline" size="sm" onClick={load} disabled={dataLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${dataLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {loadError && (
          <div className="mb-6 p-4 rounded-lg border border-destructive/40 bg-destructive/5 text-sm text-destructive">
            Could not load data: {loadError}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bug className="w-4 h-4" /> Failure reports</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{failures.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Rate limited</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{rateLimited}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Slow (&gt;3s)</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{slowRequests}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> 5xx errors</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{errors}</p></CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Application failures</CardTitle></CardHeader>
          <CardContent>
            {dataLoading && !failures.length ? <p className="text-sm text-muted-foreground">Loading…</p> :
              failures.length === 0 ? <p className="text-sm text-muted-foreground">No failures reported. Everything is healthy.</p> :
              <div className="space-y-2 max-h-[28rem] overflow-auto">
                {failures.map((e) => (
                  <div key={e.id} className="p-3 rounded-lg border text-sm space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={severityColor(e.severity) as any}>{e.severity}</Badge>
                        <span className="font-mono text-xs">{e.event_type}</span>
                        {e.details?.route && <span className="text-xs text-muted-foreground truncate">{e.details.route}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    {e.details?.message && (
                      <p className="text-xs text-foreground/80 break-words">{e.details.message}</p>
                    )}
                    {e.details?.stack && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Stack trace</summary>
                        <pre className="whitespace-pre-wrap mt-1">{e.details.stack}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            }
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>Security events</CardTitle></CardHeader>
          <CardContent>
            {dataLoading && !otherEvents.length ? <p className="text-sm text-muted-foreground">Loading…</p> :
              otherEvents.length === 0 ? <p className="text-sm text-muted-foreground">No events recorded yet.</p> :
              <div className="space-y-2 max-h-96 overflow-auto">
                {otherEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={severityColor(e.severity) as any}>{e.severity}</Badge>
                      <span className="font-mono">{e.event_type}</span>
                      {e.details?.endpoint && <span className="text-muted-foreground text-xs truncate">{e.details.endpoint}</span>}
                      {e.ip_address && <span className="text-muted-foreground text-xs">{e.ip_address}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent API requests</CardTitle></CardHeader>
          <CardContent>
            {dataLoading && !logs.length ? <p className="text-sm text-muted-foreground">Loading…</p> :
              logs.length === 0 ? <p className="text-sm text-muted-foreground">No requests logged yet.</p> :
              <div className="space-y-2 max-h-96 overflow-auto">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={(l.status_code ?? 0) >= 500 ? "destructive" : (l.status_code ?? 0) >= 400 ? "default" : "secondary"}>
                        {l.status_code ?? "—"}
                      </Badge>
                      <span className="font-mono text-xs">{l.method}</span>
                      <span className="font-mono text-xs truncate">{l.endpoint}</span>
                      {l.latency_ms != null && <span className="text-xs text-muted-foreground">{l.latency_ms}ms</span>}
                      {l.error && <span className="text-xs text-destructive truncate">{l.error}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{new Date(l.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            }
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
