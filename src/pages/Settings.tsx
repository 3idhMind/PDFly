import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Key, Plus, Trash2, Copy, EyeOff, Activity, BarChart3, FileText, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import type { User } from "@supabase/supabase-js";

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  is_active: boolean;
  rate_limit_per_min: number;
  created_at: string;
  last_used_at: string | null;
}

interface UsageStats {
  totalRequests: number;
  successCount: number;
  failCount: number;
  totalDocuments: number;
  totalBytes: number;
  avgProcessingMs: number;
}

interface RecentDoc {
  id: string;
  title: string;
  template: string | null;
  language: string | null;
  page_size: string | null;
  size_bytes: number;
  storage_path: string | null;
  created_at: string;
}

const Settings = () => {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats>({ totalRequests: 0, successCount: 0, failCount: 0, totalDocuments: 0, totalBytes: 0, avgProcessingMs: 0 });
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
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
    if (user) {
      loadApiKeys();
      loadUsageStats();
      loadRecentDocs();
    }
  }, [user]);

  const loadApiKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("api_keys").select("id, key_prefix, name, is_active, rate_limit_per_min, created_at, last_used_at").order("created_at", { ascending: false });
    if (!error && data) setApiKeys(data);
    setLoading(false);
  };

  const loadUsageStats = async () => {
    const { data, error } = await supabase.from("api_usage").select("status, document_count, bytes_processed, processing_time_ms");
    if (!error && data) {
      const total = data.length;
      const success = data.filter(r => r.status === "success").length;
      setUsageStats({
        totalRequests: total,
        successCount: success,
        failCount: total - success,
        totalDocuments: data.reduce((s, r) => s + r.document_count, 0),
        totalBytes: data.reduce((s, r) => s + Number(r.bytes_processed || 0), 0),
        avgProcessingMs: total > 0 ? Math.round(data.reduce((s, r) => s + r.processing_time_ms, 0) / total) : 0,
      });
    }
  };

  const loadRecentDocs = async () => {
    // Only show docs within the 30-minute retention window
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("generated_documents")
      .select("id, title, template, language, page_size, size_bytes, storage_path, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setRecentDocs(data as RecentDoc[]);
  };

  const generateApiKey = async () => {
    if (!user || !newKeyName.trim()) {
      toast({ title: "Name required", description: "Please enter a name for your API key", variant: "destructive" });
      return;
    }

    const rawKey = `pdfgen_${crypto.randomUUID().replace(/-/g, "")}`;
    const prefix = rawKey.slice(0, 12);
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const { error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      key_hash: keyHash,
      key_prefix: prefix,
      name: newKeyName.trim(),
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setNewKeyRevealed(rawKey);
    setNewKeyName("");
    loadApiKeys();
    toast({ title: "API Key Created", description: "Copy it now — it won't be shown again!" });
  };

  const revokeKey = async (id: string) => {
    await supabase.from("api_keys").update({ is_active: false }).eq("id", id);
    loadApiKeys();
    toast({ title: "Key Revoked" });
  };

  const deleteKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    loadApiKeys();
    toast({ title: "Key Deleted" });
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied!" });
  };

  const formatBytes = (b: number) => {
    if (b === 0) return "0 B";
    const k = 1024;
    const s = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
  };

  const downloadDoc = async (doc: RecentDoc) => {
    if (!doc.storage_path) {
      toast({ title: "No file", description: "This document has no downloadable PDF (generated before storage was enabled)", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.storage
      .from("generated-pdfs")
      .createSignedUrl(doc.storage_path, 1800);
    if (error || !data?.signedUrl) {
      toast({ title: "Error", description: "Failed to generate download URL (file may have expired)", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Settings & API Management</h1>

        {/* Usage Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Total Requests", value: usageStats.totalRequests, icon: Activity },
            { label: "Successful", value: usageStats.successCount, icon: BarChart3 },
            { label: "Failed", value: usageStats.failCount, icon: BarChart3 },
            { label: "Documents", value: usageStats.totalDocuments, icon: BarChart3 },
            { label: "Data Processed", value: formatBytes(usageStats.totalBytes), icon: BarChart3 },
            { label: "Avg Time", value: `${usageStats.avgProcessingMs}ms`, icon: Activity },
          ].map((stat, i) => (
            <Card key={i} className="p-4 text-center">
              <stat.icon className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Generate New Key */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" /> Generate New API Key
          </h2>
          <div className="flex gap-3">
            <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (e.g. My Website)" className="flex-1" />
            <Button onClick={generateApiKey}>
              <Plus className="w-4 h-4 mr-1" /> Generate
            </Button>
          </div>

          {newKeyRevealed && (
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-2">⚠️ Copy this key now — it won't be shown again!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-2 rounded break-all">{newKeyRevealed}</code>
                <Button size="sm" variant="outline" onClick={() => copyKey(newKeyRevealed)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewKeyRevealed(null)}>Dismiss</Button>
            </div>
          )}
        </Card>

        {/* API Keys List */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Your API Keys</h2>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-muted-foreground">No API keys yet. Generate one above.</p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className={`flex items-center justify-between p-4 rounded-lg border ${key.is_active ? "bg-card" : "bg-muted/50 opacity-60"}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{key.name}</span>
                      {!key.is_active && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">Revoked</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <code>{key.key_prefix}••••••••</code> · Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {key.is_active && (
                      <Button size="sm" variant="outline" onClick={() => revokeKey(key.id)}>
                        <EyeOff className="w-3 h-3 mr-1" /> Revoke
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteKey(key.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Documents */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Recent Documents
            </h2>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
              30-min retention
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Only PDFs generated via the <strong>REST API</strong> appear here. Web UI generations are 100% client-side and are never uploaded or stored on our servers. Documents shown below are auto-deleted from our database after 30 minutes — we cannot restore anything.
          </p>
          {recentDocs.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-lg">
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">No active API-generated documents.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Web UI generations stay private on your device and won't appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDocs.map((doc) => {
                const ageMs = Date.now() - new Date(doc.created_at).getTime();
                const minsLeft = Math.max(0, Math.ceil((30 * 60 * 1000 - ageMs) / 60000));
                return (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors text-sm gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground truncate block">{doc.title}</span>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                        <span>{doc.template || "—"}</span>
                        <span>·</span>
                        <span>{doc.page_size || "—"}</span>
                        <span>·</span>
                        <span>{formatBytes(doc.size_bytes)}</span>
                        <span>·</span>
                        <span className={minsLeft <= 5 ? "text-destructive font-medium" : "text-primary"}>
                          Expires in {minsLeft}m
                        </span>
                      </div>
                    </div>
                    {doc.storage_path && (
                      <Button size="sm" variant="outline" onClick={() => downloadDoc(doc)} className="shrink-0">
                        <Download className="w-3 h-3 mr-1" /> Download
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Settings;
