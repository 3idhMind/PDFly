/**
 * Admin console.
 *
 * Reachable only by the account named in ADMIN_EMAIL. The gate here decides
 * whether to *render*; every endpoint it calls re-derives admin status from the
 * Firebase-verified ID token, so forcing this open in devtools yields empty
 * panels and 403s rather than data.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { admin, type FeedbackEntry, type AdminPost } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trash2, Star, RefreshCw, ExternalLink } from "lucide-react";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function Admin() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();

  const [feedback, setFeedback] = useState<FeedbackEntry[] | null>(null);
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    // Settled, not all: one failing panel must not blank the other.
    const [f, p] = await Promise.allSettled([admin.feedback(), admin.posts()]);
    if (f.status === "fulfilled") setFeedback(f.value.feedback);
    else toast({ title: "Couldn't load feedback", variant: "destructive" });
    if (p.status === "fulfilled") setPosts(p.value.posts);
    else toast({ title: "Couldn't load posts", variant: "destructive" });
    setBusy(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      navigate("/", { replace: true });
      return;
    }
    void load();
  }, [isAdmin, loading, navigate, load]);

  if (loading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const removeFeedback = async (id: string) => {
    await admin.deleteFeedback(id);
    setFeedback((prev) => prev?.filter((f) => f.id !== id) ?? null);
  };

  const removePost = async (slug: string) => {
    if (!window.confirm(`Delete "${slug}"? The URL will start returning 404.`)) return;
    await admin.deletePost(slug);
    setPosts((prev) => prev?.filter((p) => p.slug !== slug) ?? null);
    toast({ title: "Deleted", description: "Live after the next deploy." });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>Admin | PDFly</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />

      <main className="container mx-auto max-w-5xl flex-1 px-5 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin</h1>
            <p className="text-sm text-muted-foreground">Feedback inbox and blog posts.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={busy} className="h-11">
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="feedback">
          <TabsList>
            <TabsTrigger value="feedback">
              Feedback {feedback ? `(${feedback.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="posts">Blog {posts ? `(${posts.length})` : ""}</TabsTrigger>
          </TabsList>

          {/* ------------------------------------------------------ feedback */}
          <TabsContent value="feedback" className="mt-5 space-y-3">
            {feedback?.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No feedback yet.
              </p>
            )}
            {feedback?.map((f) => (
              <Card key={f.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium text-foreground">{f.name || "Anonymous"}</span>
                  {f.email && (
                    <a href={`mailto:${f.email}`} className="text-primary hover:underline">
                      {f.email}
                    </a>
                  )}
                  {f.rating != null && (
                    <span className="inline-flex items-center gap-0.5 text-amber-500">
                      {f.rating}
                      <Star className="h-3 w-3 fill-current" />
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{fmt(f.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{f.message}</p>
                <div className="mt-3 flex items-center gap-3">
                  {f.path && (
                    <span className="font-mono text-xs text-muted-foreground">{f.path}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFeedback(f.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* --------------------------------------------------------- posts */}
          <TabsContent value="posts" className="mt-5 space-y-3">
            <Card className="border-dashed p-4 text-sm text-muted-foreground">
              Posts are written through <code className="text-foreground">/api/blog</code> — by
              the Python script in <code className="text-foreground">scripts/publish_post.py</code>,
              or by any agent holding a <code className="text-foreground">blog:write</code> key.
              A post goes live at the next deploy, because every post is prerendered to static
              HTML so crawlers get real content instead of an empty shell.
            </Card>

            {posts?.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No posts in Firestore yet. The site is still serving the built-in list.
              </p>
            )}
            {posts?.map((p) => (
              <Card key={p.slug} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{p.title}</span>
                    {p.category && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">
                        {p.category}
                      </span>
                    )}
                    {p.publishAt && Date.parse(p.publishAt) > Date.now() && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-500">
                        scheduled {fmt(p.publishAt)}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">/blog/{p.slug}</span>
                </div>
                <Button variant="ghost" size="sm" asChild className="h-9">
                  <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removePost(p.slug)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
