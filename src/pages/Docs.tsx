/**
 * API documentation.
 *
 * ── What was wrong with the old page ──────────────────────────────────────
 * Roughly 1,700 lines of hand-written blocks, one per endpoint, each carrying
 * its own copy of the request and response shape. Three separate times those
 * copies drifted from the handlers: a `url` field no endpoint returned, an
 * `expires_in_seconds` that never existed, and an endpoint documented as
 * returning images when it returns single-page PDFs. Nothing could catch it,
 * because nothing else in the codebase knew what the page claimed.
 *
 * ── What this does instead ────────────────────────────────────────────────
 * Everything renders from `src/lib/apiSpec.ts`. The sidebar, the search index,
 * the endpoint cards and the code samples all read the same objects, so they
 * cannot disagree with each other, and a new endpoint is one entry rather than
 * a copy-pasted section.
 *
 * ── Navigation ────────────────────────────────────────────────────────────
 * The founder's requirement was one click to any method. A sticky sidebar on
 * desktop, a sheet on mobile, plus a filter box that narrows both the sidebar
 * and the body. Scroll position drives which item is highlighted, so the
 * sidebar always shows where you are.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorageNotice } from "@/components/StorageNotice";
import { CodeSwitcher } from "@/components/CodeSwitcher";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ENDPOINTS,
  GROUPS,
  LIMITS,
  ERRORS,
  AUTH_LABEL,
  STORAGE_BLOCK,
  BASE_URL,
  type Endpoint,
  type Field,
} from "@/lib/apiSpec";
import { Search, Menu, X, Copy, Check, KeyRound, Zap, AlertCircle, Link2 } from "lucide-react";

/* --------------------------------------------------------------- helpers */

const METHOD_STYLE: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-400",
};

/** Builds the three examples from the spec, so they cannot drift from it. */
function samplesFor(ep: Endpoint) {
  const url = `${BASE_URL}${ep.path}`;
  const body = ep.exampleBody ? JSON.stringify(ep.exampleBody, null, 2) : null;
  const hasBody = ep.method !== "GET" && body;

  const curl = hasBody
    ? `curl -X ${ep.method} ${url} \\
  -H "Authorization: Bearer $PDFLY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`
    : `curl ${url} \\
  -H "Authorization: Bearer $PDFLY_API_KEY"`;

  const js = hasBody
    ? `const res = await fetch("${url}", {
  method: "${ep.method}",
  headers: {
    Authorization: \`Bearer \${process.env.PDFLY_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${body}),
});

const data = await res.json();
if (!res.ok) throw new Error(data.message);`
    : `const res = await fetch("${url}", {
  headers: { Authorization: \`Bearer \${process.env.PDFLY_API_KEY}\` },
});

const data = await res.json();`;

  const py = hasBody
    ? `import os, requests

res = requests.${ep.method.toLowerCase()}(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ['PDFLY_API_KEY']}"},
    json=${body.replace(/true/g, "True").replace(/false/g, "False").replace(/null/g, "None")},
    timeout=60,
)
res.raise_for_status()
data = res.json()`
    : `import os, requests

res = requests.get(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ['PDFLY_API_KEY']}"},
    timeout=30,
)
data = res.json()`;

  return [
    { language: "bash", label: "cURL", code: curl },
    { language: "javascript", label: "JavaScript", code: js },
    { language: "python", label: "Python", code: py },
  ];
}

const FieldTable = ({ fields, caption }: { fields: Field[]; caption: string }) => (
  <div className="mt-4">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{caption}</p>
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[32rem] text-sm">
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-3 py-2 align-top">
                <code className="font-mono text-xs text-foreground">{f.name}</code>
                {f.required && <span className="ml-1.5 text-[10px] font-semibold text-primary">required</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                {f.type}
              </td>
              <td className="px-3 py-2 align-top text-muted-foreground">{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ------------------------------------------------------------------ page */

export default function Docs() {
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [active, setActive] = useState<string>(ENDPOINTS[0].id);
  const [copiedBase, setCopiedBase] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENDPOINTS;
    return ENDPOINTS.filter((e) =>
      `${e.name} ${e.path} ${e.legacyPath ?? ""} ${e.summary} ${e.group}`.toLowerCase().includes(q),
    );
  }, [query]);

  /* Highlights the sidebar entry for whichever endpoint is on screen. */
  useEffect(() => {
    observer.current?.disconnect();
    observer.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Top third of the viewport: an endpoint counts as "current" once its
      // heading is near the top, not when it first peeks in from the bottom.
      { rootMargin: "-80px 0px -66% 0px" },
    );
    for (const ep of filtered) {
      const el = document.getElementById(ep.id);
      if (el) observer.current.observe(el);
    }
    return () => observer.current?.disconnect();
  }, [filtered]);

  const jump = (id: string) => {
    setNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyBase = () => {
    navigator.clipboard.writeText(BASE_URL);
    setCopiedBase(true);
    window.setTimeout(() => setCopiedBase(false), 1600);
  };

  const nav = (
    <nav className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter endpoints"
          className="h-11 pl-9"
          aria-label="Filter endpoints"
        />
      </div>

      {GROUPS.map((group) => {
        const items = filtered.filter((e) => e.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.map((ep) => (
                <li key={ep.id}>
                  <button
                    onClick={() => jump(ep.id)}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors sm:min-h-9 ${
                      active === ep.id
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    }`}
                  >
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${METHOD_STYLE[ep.method]}`}>
                      {ep.method}
                    </span>
                    <span className="truncate">{ep.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="border-t border-border pt-4">
        <ul className="space-y-0.5">
          {[
            ["limits", "Limits"],
            ["errors", "Error codes"],
            ["storage", "File retention"],
          ].map(([id, label]) => (
            <li key={id}>
              <button
                onClick={() => jump(id)}
                className="flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground sm:min-h-9"
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEOHead />

      <Header />

      <div className="container mx-auto max-w-7xl flex-1 px-5 py-8">
        {/* ------------------------------------------------------ mobile nav */}
        <div className="mb-4 lg:hidden">
          <Button
            variant="outline"
            className="h-11 w-full justify-start"
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
          >
            {navOpen ? <X className="mr-2 h-4 w-4" /> : <Menu className="mr-2 h-4 w-4" />}
            {navOpen ? "Close" : "Jump to an endpoint"}
          </Button>
          {navOpen && (
            <div className="mt-3 rounded-lg border border-border bg-card p-4">{nav}</div>
          )}
        </div>

        <div className="flex gap-10">
          {/* ---------------------------------------------------- sidebar */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">{nav}</div>
          </aside>

          {/* ------------------------------------------------------- body */}
          <main className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">API documentation</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              A REST API for generating and transforming PDFs. Every endpoint takes JSON and returns
              JSON. There is no SDK to install and nothing to configure beyond a key.
            </p>

            {/* base URL + auth */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card className="p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" /> Base URL
                </p>
                <button
                  onClick={copyBase}
                  className="flex w-full items-center justify-between rounded bg-muted px-3 py-2 text-left font-mono text-sm text-foreground transition-colors hover:bg-muted/70"
                >
                  {BASE_URL}
                  {copiedBase ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </Card>

              <Card className="p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" /> Authentication
                </p>
                <code className="block rounded bg-muted px-3 py-2 font-mono text-sm text-foreground">
                  Authorization: Bearer &lt;key&gt;
                </code>
                <p className="mt-2 text-xs text-muted-foreground">
                  Create a key in{" "}
                  <a href="/settings" className="text-primary hover:underline">
                    Settings
                  </a>
                  . It is shown once and stored only as a hash.
                </p>
              </Card>
            </div>

            <StorageNotice className="mt-6" />

            {/* ------------------------------------------------- endpoints */}
            <div className="mt-10 space-y-10">
              {filtered.length === 0 && (
                <p className="py-12 text-center text-muted-foreground">
                  Nothing matches &ldquo;{query}&rdquo;.
                </p>
              )}

              {GROUPS.map((group) => {
                const items = filtered.filter((e) => e.group === group);
                if (items.length === 0) return null;
                return (
                  <section key={group}>
                    <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </h2>
                    <div className="space-y-6">
                      {items.map((ep) => (
                        <Card key={ep.id} id={ep.id} className="scroll-mt-24 p-6">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className={`rounded px-2 py-0.5 text-xs font-bold ${METHOD_STYLE[ep.method]}`}>
                              {ep.method}
                            </span>
                            <code className="font-mono text-sm text-foreground">{ep.path}</code>
                            {ep.costsQuota && (
                              <Badge variant="secondary" className="text-[10px]">
                                <Zap className="mr-1 h-3 w-3" /> uses quota
                              </Badge>
                            )}
                          </div>

                          <h3 className="text-lg font-semibold text-foreground">{ep.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{ep.summary}</p>

                          <p className="mt-3 text-xs text-muted-foreground">
                            <span className="font-semibold">Auth:</span> {AUTH_LABEL[ep.auth]}
                            {ep.legacyPath && (
                              <>
                                {"  ·  "}
                                <span className="font-semibold">Also reachable at</span>{" "}
                                <code className="font-mono">{ep.legacyPath}</code>
                              </>
                            )}
                          </p>

                          {ep.note && (
                            <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                              <p className="text-muted-foreground">{ep.note}</p>
                            </div>
                          )}

                          {ep.request && <FieldTable fields={ep.request} caption="Request" />}
                          <FieldTable fields={ep.response} caption="Response" />

                          <div className="mt-5">
                            <CodeSwitcher entries={samplesFor(ep)} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* ---------------------------------------------------- limits */}
            <section id="limits" className="mt-14 scroll-mt-24">
              <h2 className="mb-3 text-xl font-bold text-foreground">Limits</h2>
              <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
                The first two are platform limits rather than policy. They are stated here so nobody
                has to discover them from a failed request.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[36rem] text-sm">
                  <tbody>
                    {LIMITS.map((l) => (
                      <tr key={l.label} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-3 py-2.5 align-top font-medium text-foreground">{l.label}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs text-primary">{l.value}</td>
                        <td className="px-3 py-2.5 align-top text-muted-foreground">{l.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ---------------------------------------------------- errors */}
            <section id="errors" className="mt-14 scroll-mt-24">
              <h2 className="mb-3 text-xl font-bold text-foreground">Error codes</h2>
              <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
                Every failure returns{" "}
                <code className="font-mono text-xs">{`{ "error": "CODE", "message": "..." }`}</code>. Branch on{" "}
                <code className="font-mono text-xs">error</code>, show{" "}
                <code className="font-mono text-xs">message</code>.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[36rem] text-sm">
                  <tbody>
                    {ERRORS.map((e) => (
                      <tr key={e.code} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs text-muted-foreground">{e.status}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs text-foreground">{e.code}</td>
                        <td className="px-3 py-2.5 align-top text-muted-foreground">{e.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* --------------------------------------------------- storage */}
            <section id="storage" className="mt-14 scroll-mt-24">
              <h2 className="mb-3 text-xl font-bold text-foreground">File retention</h2>
              <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
                Every successful response carries a <code className="font-mono text-xs">storage</code>{" "}
                block saying whether the file can be fetched again or has to be saved now. Read it
                rather than assuming either behaviour.
              </p>
              <FieldTable fields={STORAGE_BLOCK} caption="storage" />
              <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
                When a download link is issued it points at{" "}
                <code className="font-mono text-xs">pdfly.3idhmind.in</code>, never at the storage
                provider, and it stops working after an hour. The stored copy is deleted at the same
                time.
              </p>
            </section>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
