import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Key, Plus, Copy, Trash2, Activity, BarChart3, FileText, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { SITE_URL } from "@/lib/config";
import { formatBytes } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { ApiMaintenanceNotice } from "@/components/ApiMaintenanceNotice";
import { PRODUCT_ID } from "@/lib/firebase/client";
import { fs, getDb } from "@/lib/firebase/firestore";
import { api, ApiError, type ApiKeySummary, type CreatedApiKey } from "@/lib/api";

/** Mirrors PDFLY_FREE_TIER_MONTHLY_QUOTA on the server. */
const FREE_TIER_MONTHLY_QUOTA = 100;

interface MonthUsage {
  pdfsGenerated: number;
  apiCalls: number;
  bytesProcessed: number;
}

const currentMonthId = () => new Date().toISOString().slice(0, 7); // "2026-08"

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [usage, setUsage] = useState<MonthUsage>({ pdfsGenerated: 0, apiCalls: 0, bytesProcessed: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?next=/settings");
  }, [user, authLoading, navigate]);

  const loadKeys = useCallback(async () => {
    try {
      const { keys } = await api.listKeys();
      setApiKeys(keys);
    } catch (err) {
      toast({
        title: "Couldn't load API keys",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadUsage = useCallback(async () => {
    if (!user) return;
    try {
      // One document per calendar month — a missing document simply means zero
      // used, which is why there is no monthly reset job to go wrong.
      const [{ doc, getDoc }, db] = await Promise.all([fs(), getDb()]);
      const snap = await getDoc(
        doc(db, "users", user.uid, "products", PRODUCT_ID, "usage", currentMonthId()),
      );
      if (snap.exists()) {
        const d = snap.data();
        setUsage({
          pdfsGenerated: d.pdfsGenerated ?? 0,
          apiCalls: d.apiCalls ?? 0,
          bytesProcessed: d.bytesProcessed ?? 0,
        });
      }
    } catch {
      /* Usage is informational — never block the page on it. */
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadKeys();
      void loadUsage();
    }
  }, [user, loadKeys, loadUsage]);

  const handleCreate = async () => {
    const name = newKeyName.trim();
    if (!name) {
      toast({ title: "Name required", description: "Give the key a name so you can tell them apart.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const result = await api.createKey(name);
      setCreated(result);
      setNewKeyName("");
      await loadKeys();
      toast({ title: "API key created", description: "Copy it now — it can't be shown again." });
    } catch (err) {
      toast({
        title: "Couldn't create key",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: ApiKeySummary) => {
    if (!window.confirm(`Revoke "${key.name}"? Any app using it stops working immediately, and this cannot be undone.`)) {
      return;
    }
    try {
      await api.revokeKey(key.keyId);
      await loadKeys();
      toast({ title: "Key revoked", description: "It will no longer authenticate any request." });
    } catch (err) {
      toast({
        title: "Couldn't revoke key",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    toast({ title: "Copied" });
  };

  if (authLoading || !user) return null;

  const quotaPct = Math.min(100, Math.round((usage.pdfsGenerated / FREE_TIER_MONTHLY_QUOTA) * 100));

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
      <SEOHead
        title="Settings & API Keys — PDFly"
        description="Manage your PDFly API keys, view usage statistics, and configure rate limits for your PDF generation account."
        canonical={`${SITE_URL}/settings`}
      />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="font-display text-3xl font-bold text-foreground mb-6">Settings &amp; API Management</h1>

        <ApiMaintenanceNotice className="mb-6" />

        {/* This month's usage */}
        <Card className="p-6 mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> This month
            </h2>
            <span className="text-xs text-muted-foreground font-mono">{currentMonthId()}</span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-foreground">{usage.pdfsGenerated}</span>
            <span className="text-muted-foreground">/ {FREE_TIER_MONTHLY_QUOTA} PDFs</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${quotaPct >= 90 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
            {[
              { label: "API calls", value: usage.apiCalls, icon: BarChart3 },
              { label: "Data processed", value: formatBytes(usage.bytesProcessed), icon: BarChart3 },
              { label: "Resets", value: "1st of month", icon: Activity },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <s.icon className="w-4 h-4 text-primary mx-auto mb-1" />
                <div className="text-lg font-semibold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Only PDFs generated through the REST API count towards this. Anything you make in the
            browser is processed on your own device and isn't metered at all.
          </p>
        </Card>

        {/* Create a key */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> Create an API key
          </h2>
          <div className="flex gap-3">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
              placeholder="Key name (e.g. My Website)"
              maxLength={60}
              className="flex-1"
            />
            <Button onClick={handleCreate} disabled={creating}>
              <Plus className="w-4 h-4 mr-1" /> {creating ? "Creating…" : "Create"}
            </Button>
          </div>

          {created && (
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-1">
                Copy this key now — it won't be shown again.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                We only store a SHA-256 hash of it, so we genuinely cannot show it to you later —
                not even if you ask.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-2.5 rounded break-all font-mono">{created.key}</code>
                <Button size="sm" variant="outline" onClick={() => copy(created.key)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setCreated(null)}>
                I've saved it
              </Button>
            </div>
          )}
        </Card>

        {/* Key list */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Your API keys</h2>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-muted-foreground text-sm">No API keys yet. Create one above.</p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.keyId} className="flex items-center justify-between p-4 rounded-lg border bg-card gap-3">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{key.name}</span>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      <code className="font-mono">{key.keyPrefix}••••••••</code>
                      {key.createdAt && ` · Created ${new Date(key.createdAt).toLocaleDateString()}`}
                      {key.lastUsedAt
                        ? ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                        : " · Never used"}
                      {` · ${key.rateLimitPerMin}/min`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevoke(key)}
                    className="text-destructive hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
            Revoking is immediate and permanent. Because only the hash is stored, a revoked key can
            never be recovered — by you or by us.
          </p>
        </Card>

        {/* Recent documents */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-primary" /> Recent documents
          </h2>
          <div className="text-center py-10 border border-dashed border-border rounded-lg">
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">No API-generated documents.</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-md mx-auto">
              Only PDFs made through the REST API ever appear here. Anything you generate in the
              browser stays on your device and is never uploaded.
            </p>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Settings;
