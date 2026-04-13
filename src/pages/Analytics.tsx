import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, FileText, Clock, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

const COLORS = [
  "hsl(243, 100%, 69%)", "hsl(260, 100%, 75%)", "hsl(200, 80%, 50%)",
  "hsl(150, 60%, 45%)", "hsl(30, 90%, 55%)", "hsl(340, 80%, 55%)",
  "hsl(180, 60%, 45%)", "hsl(50, 90%, 50%)",
];

const Analytics = () => {
  const [user, setUser] = useState<User | null>(null);
  const [usageOverTime, setUsageOverTime] = useState<{ date: string; count: number }[]>([]);
  const [byTemplate, setByTemplate] = useState<{ name: string; value: number }[]>([]);
  const [byLanguage, setByLanguage] = useState<{ name: string; value: number }[]>([]);
  const [byPageSize, setByPageSize] = useState<{ name: string; value: number }[]>([]);
  const [stats, setStats] = useState({ total: 0, avgTime: 0, totalBytes: 0, successRate: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    const [usageRes, docsRes] = await Promise.all([
      supabase.from("api_usage").select("*"),
      supabase.from("generated_documents").select("*"),
    ]);

    const usage = usageRes.data || [];
    const docs = docsRes.data || [];

    // Stats
    const successCount = usage.filter((r) => r.status === "success").length;
    setStats({
      total: usage.length,
      avgTime: usage.length ? Math.round(usage.reduce((s, r) => s + r.processing_time_ms, 0) / usage.length) : 0,
      totalBytes: usage.reduce((s, r) => s + Number(r.bytes_processed || 0), 0),
      successRate: usage.length ? Math.round((successCount / usage.length) * 100) : 0,
    });

    // Usage over time (group by day)
    const byDay: Record<string, number> = {};
    usage.forEach((r) => {
      const day = r.created_at.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    setUsageOverTime(
      Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30)
        .map(([date, count]) => ({ date, count }))
    );

    // By template
    const tMap: Record<string, number> = {};
    docs.forEach((d) => { tMap[d.template || "unknown"] = (tMap[d.template || "unknown"] || 0) + 1; });
    setByTemplate(Object.entries(tMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

    // By language
    const lMap: Record<string, number> = {};
    docs.forEach((d) => { lMap[d.language || "auto"] = (lMap[d.language || "auto"] || 0) + 1; });
    setByLanguage(Object.entries(lMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

    // By page size
    const pMap: Record<string, number> = {};
    docs.forEach((d) => { pMap[d.page_size || "A4"] = (pMap[d.page_size || "A4"] || 0) + 1; });
    setByPageSize(Object.entries(pMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
  };

  const formatBytes = (b: number) => {
    if (b === 0) return "0 B";
    const k = 1024;
    const s = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <h1 className="text-3xl font-bold text-foreground mb-8 flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-primary" /> Analytics Dashboard
        </h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Activity, label: "Total Requests", value: stats.total },
            { icon: FileText, label: "Success Rate", value: `${stats.successRate}%` },
            { icon: Clock, label: "Avg Processing", value: `${stats.avgTime}ms` },
            { icon: TrendingUp, label: "Data Processed", value: formatBytes(stats.totalBytes) },
          ].map((s, i) => (
            <Card key={i} className="p-5 text-center">
              <s.icon className="w-6 h-6 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Usage Over Time */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Requests Over Time (Last 30 Days)</h2>
          {usageOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={usageOverTime}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(243, 100%, 69%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">No data yet. Generate some PDFs via the API to see analytics.</p>
          )}
        </Card>

        {/* Charts Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[
            { title: "By Template", data: byTemplate },
            { title: "By Language", data: byLanguage },
            { title: "By Page Size", data: byPageSize },
          ].map((chart) => (
            <Card key={chart.title} className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">{chart.title}</h2>
              {chart.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {chart.data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">No data</p>
              )}
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Analytics;
