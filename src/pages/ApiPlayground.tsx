import { useCallback, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Play, ExternalLink, Loader2, KeyRound, Copy, Check } from "lucide-react";
import { getIdToken } from "@/lib/firebase/auth";
import { StorageNotice } from "@/components/StorageNotice";
import { useToast } from "@/hooks/use-toast";

// Same-origin. This used to be hardcoded to the production URL, which meant
// running locally fired real requests at production — cross-origin, against
// endpoints expecting a different token type, producing "cannot fetch API".
// Relative keeps localhost on localhost and production on production.
const API_BASE = "/api";

type EndpointKey =
  | "generate-pdf"
  | "merge-pdf"
  | "split-pdf"
  | "compress-pdf"
  | "pdf-to-images";

interface EndpointDef {
  key: EndpointKey;
  label: string;
  path: string;
  description: string;
  sample: unknown;
}

const SAMPLE_PDF_A = "https://pdfobject.com/pdf/sample.pdf";
const SAMPLE_PDF_B = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

const ENDPOINTS: EndpointDef[] = [
  {
    key: "generate-pdf",
    label: "Generate PDF (Text)",
    path: "/generate-pdf",
    description: "Render one or more text documents to PDF.",
    sample: {
      documents: [
        { title: "Hello PDFly", content: "# Welcome\n\nThis is a sample document generated from the API Playground." },
      ],
      template: "professional",
      language: "auto",
      pageSize: "A4",
    },
  },
  {
    key: "merge-pdf",
    label: "Merge PDFs",
    path: "/merge-pdf",
    description: "Combine 2–20 PDFs into a single file.",
    sample: { pdfs: [SAMPLE_PDF_A, SAMPLE_PDF_B] },
  },
  {
    key: "split-pdf",
    label: "Split PDF",
    path: "/split-pdf",
    description: "Extract page ranges (e.g. 1-2,4).",
    sample: { pdf: SAMPLE_PDF_A, ranges: "1" },
  },
  {
    key: "compress-pdf",
    label: "Compress PDF",
    path: "/compress-pdf",
    description: "Strip metadata & optimize object streams.",
    sample: { pdf: SAMPLE_PDF_A },
  },
  {
    key: "pdf-to-images",
    label: "PDF → Images (per-page PDFs)",
    path: "/pdf-to-images",
    description: "Return each page as a single-page PDF.",
    sample: { pdf: SAMPLE_PDF_A },
  },
];

interface PreviewItem { label: string; url: string }

/* --------------------------------------------------- reading a JSON response */

/**
 * The response is whatever the server sent, so it is read defensively rather
 * than cast to a shape we assume. Every helper here answers "is this field
 * usable", never "trust me, it is there".
 */
const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const str = (o: Record<string, unknown>, k: string): string =>
  typeof o[k] === "string" ? (o[k] as string) : "";

/**
 * A blob URL, because an iframe cannot reliably render a `data:application/pdf`
 * source — Chrome blocks it. Blob URLs are revoked when the previews change.
 */
function blobUrlFromBase64(b64: string): string | null {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  } catch {
    return null;
  }
}

/** A file comes back inline when it is small and as a signed link when it is not. */
function fileUrlOf(o: Record<string, unknown>): string | null {
  const link = str(o, "download_url");
  if (link) return link;
  const inline = str(o, "pdf_base64") || str(o, "data");
  return inline ? blobUrlFromBase64(inline) : null;
}

function items(
  root: Record<string, unknown>,
  key: string,
  label: (item: Record<string, unknown>, index: number) => string,
): PreviewItem[] {
  const list = Array.isArray(root[key]) ? (root[key] as unknown[]) : [];
  return list.flatMap((raw, i) => {
    const item = asRecord(raw);
    if (!item) return [];
    const url = fileUrlOf(item);
    return url ? [{ label: label(item, i), url }] : [];
  });
}

const ApiPlayground = () => {
  const { toast } = useToast();
  const [selected, setSelected] = useState<EndpointKey>("merge-pdf");
  const [apiKey, setApiKey] = useState("");
  const [useSession, setUseSession] = useState(true);
  const [body, setBody] = useState<string>(
    () => JSON.stringify(ENDPOINTS.find(e => e.key === "merge-pdf")!.sample, null, 2),
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [previews, setPreviews] = useState<PreviewItem[]>([]);

  /*
   * Inline results are previewed through blob URLs, and a blob URL pins its
   * data in memory until it is revoked. Replacing the list without revoking the
   * old one leaks every PDF the user ever previewed for the life of the tab.
   */
  const replacePreviews = useCallback((next: PreviewItem[]) => {
    setPreviews((prev) => {
      for (const p of prev) if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
      return next;
    });
  }, []);
  const [copied, setCopied] = useState(false);

  const endpoint = useMemo(() => ENDPOINTS.find(e => e.key === selected)!, [selected]);

  const switchEndpoint = (k: EndpointKey) => {
    setSelected(k);
    const def = ENDPOINTS.find(e => e.key === k)!;
    setBody(JSON.stringify(def.sample, null, 2));
    setStatus(null);
    setResponseText("");
    replacePreviews([]);
  };

  /*
   * Turns a response into previewable URLs.
   *
   * This used to look for `data.url`, `data.pdfs` and `p.url`, none of which
   * any endpoint has ever returned — generate answers with `documents`, and a
   * file arrives either as `pdf_base64`/`data` inline or as `download_url` once
   * it is too big to inline. So the preview pane was silently always empty.
   * Reading the real field names, and building a blob URL for the inline case,
   * is what makes it show anything at all.
   */
  const extractPreviews = (key: EndpointKey, data: unknown): PreviewItem[] => {
    const root = asRecord(data);
    if (!root) return [];

    switch (key) {
      case "generate-pdf":
        return items(root, "documents", (d, i) => str(d, "title") || `PDF ${i + 1}`);
      case "split-pdf":
        return items(root, "pdfs", (d, i) => str(d, "name") || `Part ${i + 1}`);
      case "pdf-to-images":
        return items(root, "pages", (d, i) => str(d, "filename") || `Page ${i + 1}`);
      case "merge-pdf":
      case "compress-pdf": {
        const url = fileUrlOf(root);
        return url ? [{ label: key === "merge-pdf" ? "Merged PDF" : "Compressed PDF", url }] : [];
      }
      default:
        return [];
    }
  };

  const run = async () => {
    setLoading(true);
    setStatus(null);
    setResponseText("");
    replacePreviews([]);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        toast({ title: "Invalid JSON", description: "Fix the request body first.", variant: "destructive" });
        setLoading(false);
        return;
      }

      let token = apiKey.trim();
      if (useSession && !token) {
        token = (await getIdToken()) ?? "";
      }
      if (!token) {
        toast({
          title: "Auth required",
          description: "Sign in to use your session, or paste an API key.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}${endpoint.path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(parsed),
      });
      setStatus(res.status);
      const text = await res.text();
      let json: unknown = null;
      try { json = JSON.parse(text); } catch { /* keep text */ }
      setResponseText(json ? JSON.stringify(json, null, 2) : text);
      if (res.ok && json) replacePreviews(extractPreviews(selected, json));
    } catch (err) {
      setResponseText(String((err as Error).message || err));
      toast({ title: "Request failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(responseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="API Playground — PDFly"
        description="Run PDFly API endpoints from your browser with sample inputs and preview generated PDFs and images."
        canonical="https://pdfly.3idhmind.in/api-playground"
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">API Playground</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Try every PDFly endpoint live. Uses your signed-in session by default, or paste an API key.
            Sample PDFs are prefilled — hit <strong>Run</strong> to see the preview.
          </p>
        </div>

        <StorageNotice className="mb-8" />

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <Card className="p-3 h-fit">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">Endpoints</div>
            <div className="flex flex-col">
              {ENDPOINTS.map(ep => (
                <button
                  key={ep.key}
                  onClick={() => switchEndpoint(ep.key)}
                  className={`text-left px-2 py-2 rounded-md text-sm transition-colors ${
                    selected === ep.key ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                  }`}
                >
                  {ep.label}
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">POST {ep.path}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Main panel */}
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs font-mono text-muted-foreground">POST {API_BASE}{endpoint.path}</div>
                  <p className="text-sm text-muted-foreground mt-1">{endpoint.description}</p>
                </div>
                <Button onClick={run} disabled={loading} className="shrink-0">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Run
                </Button>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="apikey" className="text-xs font-medium">API key (optional — leave blank to use signed-in session)</Label>
                </div>
                <Input
                  id="apikey"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setUseSession(!e.target.value); }}
                  placeholder="pdfgen_..."
                  className="font-mono text-xs"
                />
              </div>

              <Label htmlFor="body" className="text-xs font-medium mb-2 block">Request body (JSON)</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                spellCheck={false}
              />
            </Card>

            {(status !== null || responseText) && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">Response</h3>
                    {status !== null && (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        status >= 200 && status < 300 ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"
                      }`}>
                        {status}
                      </span>
                    )}
                  </div>
                  {responseText && (
                    <Button size="sm" variant="ghost" onClick={copyResponse}>
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
                    </Button>
                  )}
                </div>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-72 text-foreground">
                  <code>{responseText}</code>
                </pre>
              </Card>
            )}

            {previews.length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold text-foreground mb-3">Preview ({previews.length})</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {previews.map((p, i) => (
                    <div key={i} className="border border-border rounded-lg overflow-hidden bg-muted">
                      <div className="flex items-center justify-between px-3 py-2 bg-background border-b border-border">
                        <span className="text-xs font-medium truncate">{p.label}</span>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <iframe
                        src={p.url}
                        title={p.label}
                        className="w-full h-72 bg-white"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Signed URLs expire in 1 hour. Files are auto-deleted after that.
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ApiPlayground;
