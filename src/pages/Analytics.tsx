import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity, FileText, HardDrive, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PRODUCT_ID } from "@/lib/firebase/client";
import { fs, getDb } from "@/lib/firebase/firestore";
import { formatBytes } from "@/lib/utils";

interface MonthRow {
  month: string;
  pdfs: number;
  apiCalls: number;
  bytes: number;
}

/**
 * Usage analytics, rebuilt on the Firestore monthly usage documents.
 *
 * The previous version charted a breakdown by template, language and page size.
 * That data no longer exists, and deliberately so: recording what each user
 * generated, document by document, is exactly the kind of logging PDFly tells
 * people it does not do. Aggregate counters answer "how much am I using" —
 * which is the actual question — without keeping a record of what anyone made.
 */
const Analytics = () => {
  const { user, loading: authLoading } = useAuth();
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?next=/analytics");
  }, [user, authLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [{ collection, getDocs }, db] = await Promise.all([fs(), getDb()]);
      const snap = await getDocs(
        collection(db, "users", user.uid, "products", PRODUCT_ID, "usage"),
      );
      const rows = snap.docs
        .map((d) => {
          const v = d.data();
          return {
            month: d.id, // "YYYY-MM" — the document ID is the month
            pdfs: v.pdfsGenerated ?? 0,
            apiCalls: v.apiCalls ?? 0,
            bytes: v.bytesProcessed ?? 0,
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);
      setMonths(rows);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) void load(); }, [user, load]);

  if (authLoading || !user) return null;

  const totals = months.reduce(
    (acc, m) => ({
      pdfs: acc.pdfs + m.pdfs,
      apiCalls: acc.apiCalls + m.apiCalls,
      bytes: acc.bytes + m.bytes,
    }),
    { pdfs: 0, apiCalls: 0, bytes: 0 },
  );
  const activeMonths = months.filter((m) => m.pdfs > 0).length;

  const cards = [
    { label: "PDFs generated", value: totals.pdfs.toLocaleString(), icon: FileText },
    { label: "API calls", value: totals.apiCalls.toLocaleString(), icon: Activity },
    { label: "Data processed", value: formatBytes(totals.bytes), icon: HardDrive },
    {
      label: "Avg / active month",
      value: activeMonths ? Math.round(totals.pdfs / activeMonths).toLocaleString() : "0",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Usage analytics</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Last 12 months of API usage on your account.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((c, i) => (
            <Card key={i} className="p-5">
              <c.icon className="w-5 h-5 text-primary mb-2" />
              <div className="text-2xl font-bold text-foreground">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">PDFs per month</h2>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : months.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <Activity className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">No API usage yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm mx-auto">
                PDFs you generate in the browser are processed on your own device and aren't
                metered — only REST API calls appear here.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="pdfs" name="PDFs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            We record counts, not contents. PDFly never stores what you generated — only how many.
          </p>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Analytics;
