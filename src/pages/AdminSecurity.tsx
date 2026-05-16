import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Activity, AlertTriangle, Clock } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  user_id: string | null;
  ip_address: string | null;
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

export default function AdminSecurity() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) { navigate("/"); return; }

    const load = async () => {
      const [{ data: ev }, { data: lg }] = await Promise.all([
        supabase.from("security_events" as any).select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("api_request_logs" as any).select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      setEvents((ev as any) ?? []);
      setLogs((lg as any) ?? []);
      setDataLoading(false);
    };
    load();
  }, [isAdmin, loading, navigate]);

  if (loading || isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Verifying admin access…</div>;
  }
  if (!isAdmin) return null;

  const slowRequests = logs.filter(l => (l.latency_ms ?? 0) > 3000).length;
  const errors = logs.filter(l => (l.status_code ?? 0) >= 500).length;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Admin Security · PDFly" description="Internal admin security dashboard" />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-destructive/10">
            <ShieldAlert className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Security & Tracing</h1>
            <p className="text-sm text-muted-foreground">Audit logs, request traces, and anomaly signals</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Security events (100)</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{events.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Slow requests (&gt;3s)</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{slowRequests}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> 5xx errors</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{errors}</p></CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Recent security events</CardTitle></CardHeader>
          <CardContent>
            {dataLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              events.length === 0 ? <p className="text-sm text-muted-foreground">No events recorded yet.</p> :
              <div className="space-y-2 max-h-96 overflow-auto">
                {events.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div className="flex items-center gap-3">
                      <Badge variant={severityColor(e.severity) as any}>{e.severity}</Badge>
                      <span className="font-mono">{e.event_type}</span>
                      {e.ip_address && <span className="text-muted-foreground text-xs">{e.ip_address}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent API requests</CardTitle></CardHeader>
          <CardContent>
            {dataLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              logs.length === 0 ? <p className="text-sm text-muted-foreground">No requests logged yet.</p> :
              <div className="space-y-2 max-h-96 overflow-auto">
                {logs.map(l => (
                  <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={(l.status_code ?? 0) >= 500 ? "destructive" : (l.status_code ?? 0) >= 400 ? "default" : "secondary"}>
                        {l.status_code ?? "—"}
                      </Badge>
                      <span className="font-mono text-xs">{l.method}</span>
                      <span className="font-mono text-xs truncate">{l.endpoint}</span>
                      {l.latency_ms != null && <span className="text-xs text-muted-foreground">{l.latency_ms}ms</span>}
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
