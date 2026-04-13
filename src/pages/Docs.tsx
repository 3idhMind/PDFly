import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, Copy, BookOpen, Zap, Globe, FileText, AlertTriangle, Gauge, Lightbulb, Download, ImageIcon, ChevronDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Link } from "react-router-dom";
import { CodeSwitcher } from "@/components/CodeSwitcher";
import { SITE_URL } from "@/lib/config";

type Feature = 'text-to-pdf' | 'images-to-pdf';

const Docs = () => {
  const { toast } = useToast();
  const [postFeature, setPostFeature] = useState<Feature>('text-to-pdf');
  const [getFeature, setGetFeature] = useState<Feature>('text-to-pdf');
  const [postDropdownOpen, setPostDropdownOpen] = useState(false);
  const [getDropdownOpen, setGetDropdownOpen] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "your-project-id";
  const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1`;

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: label ? `${label} copied` : "Copied to clipboard" });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const sections = [
    { id: "quickstart", label: "Quick Start" },
    { id: "auth", label: "Authentication" },
    { id: "endpoints", label: "API Endpoints" },
    { id: "post-generate", label: "POST — Generate PDF" },
    { id: "get-retrieve", label: "GET — Retrieve Documents" },
    { id: "limits", label: "Content Limits" },
    { id: "languages", label: "Languages" },
    { id: "templates", label: "Templates" },
    { id: "choosing-mode", label: "Choosing the Right Mode" },
    { id: "page-breaks", label: "Page Breaks" },
    { id: "ratelimits", label: "Rate Limits" },
    { id: "examples", label: "Code Examples" },
    { id: "bestpractices", label: "Best Practices" },
    { id: "faq", label: "FAQ & Troubleshooting" },
  ];

  const featureLabels: Record<Feature, string> = {
    'text-to-pdf': 'Text to PDF',
    'images-to-pdf': 'Image to PDF',
  };

  const languages = [
    { code: "auto", name: "Auto-detect" }, { code: "en", name: "English" },
    { code: "hi", name: "Hindi" }, { code: "hi-en", name: "Hinglish" },
    { code: "ar", name: "Arabic" }, { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" }, { code: "ko", name: "Korean" },
    { code: "es", name: "Spanish" }, { code: "fr", name: "French" },
    { code: "de", name: "German" }, { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" }, { code: "it", name: "Italian" },
    { code: "nl", name: "Dutch" }, { code: "tr", name: "Turkish" },
    { code: "pl", name: "Polish" }, { code: "sv", name: "Swedish" },
    { code: "da", name: "Danish" }, { code: "fi", name: "Finnish" },
    { code: "no", name: "Norwegian" }, { code: "th", name: "Thai" },
    { code: "vi", name: "Vietnamese" }, { code: "id", name: "Indonesian" },
    { code: "bn", name: "Bengali" }, { code: "gu", name: "Gujarati" },
    { code: "ta", name: "Tamil" }, { code: "te", name: "Telugu" },
    { code: "kn", name: "Kannada" }, { code: "ml", name: "Malayalam" },
    { code: "mr", name: "Marathi" }, { code: "pa", name: "Punjabi" },
    { code: "ur", name: "Urdu" }, { code: "ne", name: "Nepali" },
    { code: "ms", name: "Malay" }, { code: "tl", name: "Filipino" },
    { code: "uk", name: "Ukrainian" }, { code: "cs", name: "Czech" },
    { code: "ro", name: "Romanian" }, { code: "hu", name: "Hungarian" },
    { code: "el", name: "Greek" }, { code: "he", name: "Hebrew" },
    { code: "fa", name: "Persian" }, { code: "sw", name: "Swahili" },
    { code: "ka", name: "Georgian" }, { code: "hy", name: "Armenian" },
    { code: "sr", name: "Serbian" }, { code: "hr", name: "Croatian" },
    { code: "bg", name: "Bulgarian" }, { code: "sk", name: "Slovak" },
    { code: "sl", name: "Slovenian" }, { code: "et", name: "Estonian" },
    { code: "lv", name: "Latvian" }, { code: "lt", name: "Lithuanian" },
    { code: "is", name: "Icelandic" }, { code: "cy", name: "Welsh" },
    { code: "ga", name: "Irish" }, { code: "mi", name: "Maori" },
  ];

  const templates = [
    "minimal", "professional", "creative", "modern", "classic",
    "elegant", "bold", "tech", "academic", "corporate",
    "artistic", "clean", "vibrant", "dark", "light",
  ];

  const supportedImageFormats = ["JPG/JPEG", "PNG", "GIF", "BMP", "WebP", "TIFF/TIF", "SVG", "ICO", "AVIF", "HEIC", "HEIF", "JFIF", "PSD", "RAW (CR2, NEF, ARW, DNG)", "PCX", "TGA", "PPM", "PGM", "PBM", "EXR", "HDR", "WBMP", "JP2/JPEG2000", "CUR"];

  // --- Reusable endpoint copy box ---
  const EndpointBox = ({ method, path, fullUrl }: { method: string; path: string; fullUrl: string }) => (
    <button
      onClick={() => copyToClipboard(fullUrl, `${method} ${path}`)}
      className="group flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors w-full text-left"
    >
      <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${method === 'POST' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>{method}</span>
      <code className="text-sm text-foreground flex-1 truncate">{path}</code>
      <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </button>
  );

  // --- Feature dropdown ---
  const FeatureDropdown = ({ value, onChange, open, setOpen }: { value: Feature; onChange: (f: Feature) => void; open: boolean; setOpen: (o: boolean) => void }) => (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
      >
        {featureLabels[value]}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-50 min-w-[160px]">
          {(Object.keys(featureLabels) as Feature[]).map(f => (
            <button
              key={f}
              onClick={() => { onChange(f); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between ${f === value ? 'text-primary font-medium' : 'text-foreground'}`}
            >
              {featureLabels[f]}
              {f === value && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // --- One-tap copy badge ---
  const CopyBadge = ({ text, label }: { text: string; label?: string }) => (
    <button
      onClick={() => copyToClipboard(text, label || text)}
      className="inline-flex items-center gap-1 bg-muted hover:bg-muted/80 px-2 py-1 rounded text-xs font-mono text-foreground transition-colors cursor-pointer group"
      title={`Click to copy: ${text}`}
    >
      {text}
      <Copy className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );

  // ===== RESPONSE EXAMPLES =====
  const generateResponseExample = `{
  "success": true,
  "api_version": "v1",
  "documents": [
    {
      "document_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "Invoice_42.pdf",
      "size_bytes": 15230,
      "template": "professional",
      "language": "en",
      "page_size": "A4",
      "download_url": "https://...signed-url...&token=abc123"
    }
  ],
  "usage": {
    "documents_generated": 1,
    "processing_time_ms": 523,
    "bytes_processed": 15230
  }
}`;

  const imagesToPdfResponseExample = `{
  "success": true,
  "status": "validation_passed",
  "received": {
    "image_count": 3,
    "page_size": "A4",
    "orientation": "portrait",
    "fit_mode": "fit"
  },
  "message": "Images validated. Use the web UI for full conversion."
}`;

  const listResponseExample = `{
  "success": true,
  "documents": [
    {
      "id": "a1b2c3d4-...",
      "title": "Invoice #42",
      "template": "professional",
      "language": "en",
      "page_size": "A4",
      "size_bytes": 15230,
      "download_url": "https://...signed-url...",
      "created_at": "2026-03-08T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}`;

  const singleDocResponseExample = `{
  "success": true,
  "document": {
    "id": "a1b2c3d4-...",
    "title": "Invoice #42",
    "template": "professional",
    "language": "en",
    "page_size": "A4",
    "size_bytes": 15230,
    "download_url": "https://...signed-url...",
    "created_at": "2026-03-08T10:30:00Z",
    "expires_in": "1 hour"
  }
}`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title="PDFly API Documentation — REST API for PDF Generation | 3idhMind" description="Complete API documentation for PDFly. Generate PDFs with 70+ languages, 15 templates, batch processing. Free REST API by 3idhMind." keywords="PDF API documentation, REST API PDF generation, PDFly API docs, HTML to PDF API, 3idhMind API" canonical={`${SITE_URL}/docs`} />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl flex-1">
        <div className="flex gap-8 relative">
          {/* Sidebar TOC */}
          <aside className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-20">
              <h3 className="text-sm font-semibold text-foreground mb-3">On this page</h3>
              <nav className="space-y-1">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={(e) => { e.preventDefault(); scrollToSection(s.id); }}
                    className="block text-xs text-muted-foreground hover:text-primary transition-colors py-1"
                  >
                    {s.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold font-display text-foreground mb-2 flex items-center gap-2">
                <BookOpen className="w-7 h-7 text-primary" /> API Documentation
              </h1>
              <p className="text-muted-foreground">
                Complete reference for the PDFly REST API. Generate, retrieve, and download PDFs programmatically.
              </p>
            </div>

            {/* ===== 1. QUICK START ===== */}
            <Card id="quickstart" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" /> Quick Start
              </h2>
              <div className="space-y-4">
                {[
                  { step: "1", title: "Create an account", desc: <>Sign up at <Link to="/auth" className="text-primary hover:underline">/auth</Link></> },
                  { step: "2", title: "Generate an API key", desc: <>Go to <Link to="/settings" className="text-primary hover:underline">Settings</Link> and create a new key. Copy it immediately.</> },
                  { step: "3", title: "Generate a PDF (POST)", desc: <>Send your content → get back a <code className="bg-muted px-1 rounded">download_url</code> for each PDF.</> },
                  { step: "4", title: "Download your PDF", desc: <>Use the <code className="bg-muted px-1 rounded">download_url</code> from the response. URLs are valid for 1 hour.</> },
                ].map(s => (
                  <div key={s.step} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">{s.step}</div>
                    <div>
                      <p className="font-medium text-foreground">{s.title}</p>
                      <p className="text-sm text-muted-foreground">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* ===== 2. AUTHENTICATION ===== */}
            <Card id="auth" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">Authentication</h2>
              <p className="text-sm text-muted-foreground mb-3">
                All endpoints require a Bearer token in the <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">Authorization</code> header:
              </p>
              <button onClick={() => copyToClipboard('Authorization: Bearer pdfgen_your_api_key_here', 'Auth header')} className="group w-full text-left">
                <code className="text-sm bg-muted p-3 rounded block text-foreground group-hover:bg-muted/80 transition-colors flex items-center justify-between">
                  <span>Authorization: Bearer pdfgen_your_api_key_here</span>
                  <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </code>
              </button>
              <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded text-sm text-muted-foreground">
                <strong className="text-foreground">Security:</strong> API keys are SHA-256 hashed before storage. We never store raw keys. Generate keys from <Link to="/settings" className="text-primary hover:underline">Settings</Link>.
              </div>
            </Card>

            {/* ===== 3. API ENDPOINTS ===== */}
            <Card id="endpoints" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">API Endpoints</h2>
              <div className="space-y-3">
                <EndpointBox method="POST" path="/generate-pdf" fullUrl={`${functionsBaseUrl}/generate-pdf`} />
                <EndpointBox method="POST" path="/images-to-pdf" fullUrl={`${functionsBaseUrl}/images-to-pdf`} />
                <EndpointBox method="GET" path="/get-documents" fullUrl={`${functionsBaseUrl}/get-documents`} />
                <EndpointBox method="GET" path="/get-documents?id=DOC_ID" fullUrl={`${functionsBaseUrl}/get-documents?id=DOC_ID`} />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Click any endpoint to copy the full URL.
              </p>
            </Card>

            {/* ===== 4. POST — GENERATE PDF ===== */}
            <Card id="post-generate" className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span className="bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold px-2 py-1 rounded">POST</span>
                  Generate PDF
                </h2>
                <FeatureDropdown value={postFeature} onChange={setPostFeature} open={postDropdownOpen} setOpen={setPostDropdownOpen} />
              </div>

              {/* --- TEXT TO PDF POST --- */}
              {postFeature === 'text-to-pdf' && (
                <div className="space-y-4">
                  <EndpointBox method="POST" path="/generate-pdf" fullUrl={`${functionsBaseUrl}/generate-pdf`} />
                  <p className="text-sm text-muted-foreground">Generate PDF files from HTML or plain text content. Returns download URLs for each generated document.</p>

                  <h3 className="text-sm font-semibold text-foreground">Request Body (JSON)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 text-foreground">Field</th>
                          <th className="text-left p-2 text-foreground">Type</th>
                          <th className="text-left p-2 text-foreground">Required</th>
                          <th className="text-left p-2 text-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-b border-border">
                          <td className="p-2 font-mono text-foreground">documents</td>
                          <td className="p-2">array</td>
                          <td className="p-2"><span className="text-primary font-medium">Yes</span></td>
                          <td className="p-2">1–5 objects, each with <code className="bg-muted px-1 rounded">title</code> (max 200 chars) and <code className="bg-muted px-1 rounded">content</code> (HTML/text, max 500KB)</td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="p-2 font-mono text-foreground">use_raw_html</td>
                          <td className="p-2">boolean</td>
                          <td className="p-2">No</td>
                          <td className="p-2">Default: <code className="bg-muted px-1 rounded">false</code>. Set <code className="bg-muted px-1 rounded">true</code> for custom HTML+CSS (template ignored)</td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="p-2 font-mono text-foreground">template</td>
                          <td className="p-2">string</td>
                          <td className="p-2">No</td>
                          <td className="p-2">Default: <code className="bg-muted px-1 rounded">"professional"</code>. See <a href="#templates" onClick={(e) => { e.preventDefault(); scrollToSection('templates'); }} className="text-primary hover:underline">Templates</a></td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="p-2 font-mono text-foreground">language</td>
                          <td className="p-2">string</td>
                          <td className="p-2">No</td>
                          <td className="p-2">Default: <code className="bg-muted px-1 rounded">"auto"</code>. See <a href="#languages" onClick={(e) => { e.preventDefault(); scrollToSection('languages'); }} className="text-primary hover:underline">Languages</a></td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-foreground">page_size</td>
                          <td className="p-2">string</td>
                          <td className="p-2">No</td>
                          <td className="p-2">Default: <code className="bg-muted px-1 rounded">"A4"</code>. Options: A4, Letter, Legal, A3, A5, B5, Tabloid, Executive, Square, Reel, Presentation</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground">Content Types</h3>
                  <div className="space-y-3">
                    <div className="border border-border rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-foreground mb-2">1️⃣ Plain Text</h4>
                      <p className="text-xs text-muted-foreground mb-2">Just send text. Use <code className="bg-muted px-1 rounded">\n</code> in cURL; multiline strings in Python/JS handle it automatically.</p>
                      <CodeSwitcher entries={[
                        { language: "curl", label: "cURL", code: `"content": "Invoice #42\\nAmount: $500\\nDue: March 15, 2026\\n\\nThank you."` },
                        { language: "python", label: "Python", code: `content = """Invoice #42\nAmount: $500\nDue: March 15, 2026\n\nThank you."""\n\n# Python handles line breaks automatically!` },
                        { language: "javascript", label: "JavaScript", code: "const content = `Invoice #42\nAmount: $500\nDue: March 15, 2026\n\nThank you.`;\n\n// JS template literals handle line breaks automatically!" },
                      ]} />
                    </div>
                    <div className="border border-border rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-foreground mb-2">2️⃣ HTML (Template Mode)</h4>
                      <p className="text-xs text-muted-foreground mb-2">Use HTML tags for structure. Template handles styling. CSS is ignored.</p>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto text-foreground">{`"content": "<h1>Invoice #42</h1><p>Amount: <strong>$500</strong></p><ul><li>Item 1</li></ul>"`}</pre>
                    </div>
                    <div className="border border-primary/30 rounded-lg p-4 bg-primary/5">
                      <h4 className="text-sm font-semibold text-foreground mb-2">3️⃣ Custom HTML + CSS (<code className="bg-muted px-1 rounded">use_raw_html: true</code>)</h4>
                      <p className="text-xs text-muted-foreground mb-2">Full design control. Inline styles + &lt;style&gt; blocks supported. Template is completely ignored.</p>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto text-foreground">{`{
  "documents": [{
    "title": "Report",
    "content": "<style>h1{color:navy;font-size:28px} table{width:100%;border-collapse:collapse} td{border:1px solid #ddd;padding:8px}</style><h1>Report</h1><table><tr><th>Q</th><th>Revenue</th></tr><tr><td>Q1</td><td>$50,000</td></tr></table>"
  }],
  "use_raw_html": true,
  "page_size": "A4"
}`}</pre>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground">Request Example</h3>
                  <CodeSwitcher entries={[
                    { language: "curl", label: "cURL", code: `curl -X POST '${functionsBaseUrl}/generate-pdf' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -d '{
    "documents": [
      {
        "title": "Invoice #42",
        "content": "<h1>Invoice</h1><p>Amount: $500</p>"
      }
    ],
    "language": "en",
    "template": "professional",
    "page_size": "A4"
  }'` },
                    { language: "javascript", label: "JavaScript", code: `const response = await fetch('${functionsBaseUrl}/generate-pdf', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    documents: [
      { title: 'Invoice #42', content: '<h1>Invoice</h1><p>Amount: $500</p>' }
    ],
    language: 'en',
    template: 'professional',
    page_size: 'A4'
  })
});

const data = await response.json();
if (data.success) {
  console.log('Download:', data.documents[0].download_url);
}` },
                    { language: "python", label: "Python", code: `import requests

response = requests.post(
    '${functionsBaseUrl}/generate-pdf',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
    },
    json={
        'documents': [
            {'title': 'Invoice #42', 'content': '<h1>Invoice</h1><p>Amount: $500</p>'}
        ],
        'language': 'en',
        'template': 'professional',
        'page_size': 'A4'
    }
)

data = response.json()
if data.get('success'):
    print(f"Download: {data['documents'][0]['download_url']}")` },
                    { language: "php", label: "PHP", code: `<?php
$ch = curl_init('${functionsBaseUrl}/generate-pdf');
$payload = json_encode([
    'documents' => [
        ['title' => 'Invoice #42', 'content' => '<h1>Invoice</h1><p>Amount: $500</p>']
    ],
    'language' => 'en',
    'template' => 'professional',
    'page_size' => 'A4'
]);

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer YOUR_API_KEY'
    ],
    CURLOPT_RETURNTRANSFER => true,
]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response['success']) {
    echo "Download: " . $response['documents'][0]['download_url'];
}` },
                    { language: "go", label: "Go", code: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    payload := map[string]interface{}{
        "documents": []map[string]string{
            {"title": "Invoice #42", "content": "<h1>Invoice</h1><p>Amount: $500</p>"},
        },
        "language": "en",
        "template": "professional",
        "page_size": "A4",
    }
    body, _ := json.Marshal(payload)

    req, _ := http.NewRequest("POST", "${functionsBaseUrl}/generate-pdf", bytes.NewBuffer(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer YOUR_API_KEY")

    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Println(result)
}` },
                  ]} />

                  <h3 className="text-sm font-semibold text-foreground">Success Response (200)</h3>
                  <div className="relative">
                    <Button size="sm" variant="ghost" className="absolute top-2 right-2 z-10" onClick={() => copyToClipboard(generateResponseExample)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <pre className="text-xs bg-muted p-4 rounded overflow-x-auto text-foreground">{generateResponseExample}</pre>
                  </div>
                </div>
              )}

              {/* --- IMAGE TO PDF POST --- */}
              {postFeature === 'images-to-pdf' && (
                <div className="space-y-4">
                  <EndpointBox method="POST" path="/images-to-pdf" fullUrl={`${functionsBaseUrl}/images-to-pdf`} />
                  <p className="text-sm text-muted-foreground">Convert multiple images into a single PDF. Max <strong className="text-foreground">20 images</strong> via API. For 100+ images, use the <Link to="/images-to-pdf" className="text-primary hover:underline">web UI</Link>.</p>

                  <h3 className="text-sm font-semibold text-foreground">Request Body (JSON)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 text-foreground">Field</th>
                          <th className="text-left p-2 text-foreground">Type</th>
                          <th className="text-left p-2 text-foreground">Required</th>
                          <th className="text-left p-2 text-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-b border-border">
                          <td className="p-2 font-mono text-foreground">images</td>
                          <td className="p-2">array</td>
                          <td className="p-2"><span className="text-primary font-medium">Yes</span></td>
                          <td className="p-2">Array of objects: <code className="bg-muted px-1 rounded">data</code> (base64 string), optional <code className="bg-muted px-1 rounded">filename</code>, <code className="bg-muted px-1 rounded">type</code></td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="p-2 font-mono text-foreground">page_size</td>
                          <td className="p-2">string</td>
                          <td className="p-2">No</td>
                          <td className="p-2">Default: <code className="bg-muted px-1 rounded">"A4"</code></td>
                        </tr>
                        <tr className="border-b border-border">
                          <td className="p-2 font-mono text-foreground">orientation</td>
                          <td className="p-2">string</td>
                          <td className="p-2">No</td>
                          <td className="p-2"><code className="bg-muted px-1 rounded">portrait</code> (default) or <code className="bg-muted px-1 rounded">landscape</code></td>
                        </tr>
                        <tr>
                          <td className="p-2 font-mono text-foreground">fit_mode</td>
                          <td className="p-2">string</td>
                          <td className="p-2">No</td>
                          <td className="p-2"><code className="bg-muted px-1 rounded">fit</code> (default), <code className="bg-muted px-1 rounded">fill</code>, or <code className="bg-muted px-1 rounded">original</code></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground">Supported Formats (25+)</h3>
                  <div className="flex flex-wrap gap-1">
                    {supportedImageFormats.map(fmt => (
                      <code key={fmt} className="bg-muted px-2 py-1 rounded text-xs text-foreground">{fmt}</code>
                    ))}
                  </div>

                  <h3 className="text-sm font-semibold text-foreground">Request Example</h3>
                  <CodeSwitcher entries={[
                    { language: "curl", label: "cURL", code: `curl -X POST '${functionsBaseUrl}/images-to-pdf' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -d '{
    "images": [
      { "data": "/9j/4AAQSkZJRg...(base64)...", "filename": "photo1.jpg" },
      { "data": "iVBORw0KGgo...(base64)...", "filename": "diagram.png" }
    ],
    "page_size": "A4",
    "orientation": "portrait",
    "fit_mode": "fit"
  }'` },
                    { language: "javascript", label: "JavaScript", code: `async function imagesToPdf(files) {
  const images = await Promise.all(
    files.map(async (file) => {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return { data: base64, filename: file.name, type: file.type };
    })
  );

  const response = await fetch('${functionsBaseUrl}/images-to-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY'
    },
    body: JSON.stringify({
      images,
      page_size: 'A4',
      orientation: 'portrait',
      fit_mode: 'fit'
    })
  });

  return await response.json();
}` },
                    { language: "python", label: "Python", code: `import requests
import base64
import os

API_KEY = 'YOUR_API_KEY'
BASE_URL = '${functionsBaseUrl}'

image_files = ['photo1.jpg', 'diagram.png', 'chart.webp']
images = []
for filepath in image_files:
    with open(filepath, 'rb') as f:
        data = base64.b64encode(f.read()).decode('utf-8')
        images.append({
            'data': data,
            'filename': os.path.basename(filepath),
            'type': f'image/{filepath.split(".")[-1]}'
        })

response = requests.post(
    f'{BASE_URL}/images-to-pdf',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_KEY}'
    },
    json={
        'images': images,
        'page_size': 'A4',
        'orientation': 'portrait',
        'fit_mode': 'fit'
    }
)

print(response.json())` }
                  ]} />

                  <h3 className="text-sm font-semibold text-foreground">Success Response (200)</h3>
                  <div className="relative">
                    <Button size="sm" variant="ghost" className="absolute top-2 right-2 z-10" onClick={() => copyToClipboard(imagesToPdfResponseExample)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <pre className="text-xs bg-muted p-4 rounded overflow-x-auto text-foreground">{imagesToPdfResponseExample}</pre>
                  </div>

                  <div className="p-3 bg-primary/5 border border-primary/20 rounded text-xs text-muted-foreground">
                    <strong className="text-foreground">💡 Tip:</strong> For batch conversion of 100+ images, use the <Link to="/images-to-pdf" className="text-primary hover:underline">web interface</Link> which processes everything client-side — no images are uploaded to any server.
                  </div>
                </div>
              )}
            </Card>

            {/* ===== 5. GET — RETRIEVE DOCUMENTS ===== */}
            <Card id="get-retrieve" className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded">GET</span>
                  Retrieve Documents
                </h2>
                <FeatureDropdown value={getFeature} onChange={setGetFeature} open={getDropdownOpen} setOpen={setGetDropdownOpen} />
              </div>

              {/* Download PDF */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Download className="w-4 h-4 text-primary" /> Download PDF
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">After generating a PDF, use the <code className="bg-muted px-1 rounded">download_url</code> from the response to download the file. No auth needed for download.</p>

                  <div className="bg-primary/5 border border-primary/20 rounded p-3 mb-3 text-sm text-muted-foreground">
                    <strong className="text-foreground">⏰ URL Expiry:</strong> Download URLs are valid for <strong className="text-foreground">1 hour</strong>. Use <code className="bg-muted px-1 rounded">GET /get-documents?id=DOC_ID</code> to get a fresh URL.
                  </div>

                  {getFeature === 'text-to-pdf' && (
                    <CodeSwitcher title="Download Example" entries={[
                      { language: "curl", label: "cURL", code: `# 1. Generate a PDF
RESPONSE=$(curl -s -X POST '${functionsBaseUrl}/generate-pdf' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -d '{"documents":[{"title":"Report","content":"<h1>Report</h1><p>Content</p>"}]}')

# 2. Extract download URL
DOWNLOAD_URL=$(echo $RESPONSE | jq -r '.documents[0].download_url')

# 3. Download the PDF
curl -L -o "Report.pdf" "$DOWNLOAD_URL"` },
                      { language: "javascript", label: "JavaScript", code: `const response = await fetch('${functionsBaseUrl}/generate-pdf', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    documents: [{ title: 'Report', content: '<h1>Report</h1><p>Content</p>' }]
  })
});

const data = await response.json();
if (data.success) {
  const pdfResp = await fetch(data.documents[0].download_url);
  const blob = await pdfResp.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Report.pdf';
  a.click();
}` },
                      { language: "python", label: "Python", code: `import requests

response = requests.post(
    '${functionsBaseUrl}/generate-pdf',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
    },
    json={'documents': [{'title': 'Report', 'content': '<h1>Report</h1><p>Content</p>'}]}
)

data = response.json()
if data.get('success'):
    pdf = requests.get(data['documents'][0]['download_url'])
    with open('Report.pdf', 'wb') as f:
        f.write(pdf.content)
    print("✅ Downloaded!")` }
                    ]} />
                  )}

                  {getFeature === 'images-to-pdf' && (
                    <div className="p-3 bg-accent/10 border border-accent/20 rounded text-sm text-muted-foreground">
                      <strong className="text-foreground">Note:</strong> Image to PDF currently validates via API. For full conversion, use the <Link to="/images-to-pdf" className="text-primary hover:underline">web UI</Link> which processes client-side and provides direct download.
                    </div>
                  )}
                </div>

                {/* List Documents */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">List Documents</h3>
                  <EndpointBox method="GET" path="/get-documents?limit=10&offset=0" fullUrl={`${functionsBaseUrl}/get-documents?limit=10&offset=0`} />
                  <div className="overflow-x-auto mt-3 mb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 text-foreground">Param</th>
                          <th className="text-left p-2 text-foreground">Default</th>
                          <th className="text-left p-2 text-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody className="text-muted-foreground">
                        <tr className="border-b border-border"><td className="p-2 font-mono text-foreground">limit</td><td className="p-2">20</td><td className="p-2">Max 100 per page</td></tr>
                        <tr><td className="p-2 font-mono text-foreground">offset</td><td className="p-2">0</td><td className="p-2">Skip N documents for pagination</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="relative">
                    <Button size="sm" variant="ghost" className="absolute top-2 right-2 z-10" onClick={() => copyToClipboard(listResponseExample)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <pre className="text-xs bg-muted p-4 rounded overflow-x-auto text-foreground">{listResponseExample}</pre>
                  </div>
                </div>

                {/* Single Document */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Get Single Document</h3>
                  <EndpointBox method="GET" path="/get-documents?id=DOCUMENT_ID" fullUrl={`${functionsBaseUrl}/get-documents?id=DOCUMENT_ID`} />
                  <div className="relative mt-3">
                    <Button size="sm" variant="ghost" className="absolute top-2 right-2 z-10" onClick={() => copyToClipboard(singleDocResponseExample)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <pre className="text-xs bg-muted p-4 rounded overflow-x-auto text-foreground">{singleDocResponseExample}</pre>
                  </div>
                </div>
              </div>
            </Card>

            {/* ===== 6. CONTENT LIMITS ===== */}
            <Card id="limits" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary" /> Content Limits
              </h2>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-foreground">Limit</th>
                      <th className="text-left p-2 text-foreground">Value</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border"><td className="p-2">Documents per request</td><td className="p-2 font-mono">1 – 5</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Title length</td><td className="p-2 font-mono">Max 200 characters</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Content size per document</td><td className="p-2 font-mono">Max 500 KB</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Request body size</td><td className="p-2 font-mono">Max 5 MB</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Max batch complexity score</td><td className="p-2 font-mono">10 points</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Max tables per document</td><td className="p-2 font-mono">50</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Max HTML tags per document</td><td className="p-2 font-mono">5,000</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Render timeout per document</td><td className="p-2 font-mono">30 seconds</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Max cumulative output</td><td className="p-2 font-mono">20 MB per batch</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Images per API request</td><td className="p-2 font-mono">Max 20</td></tr>
                    <tr className="border-b border-border"><td className="p-2">Images via Web UI</td><td className="p-2 font-mono">100+</td></tr>
                    <tr><td className="p-2">Download URL validity</td><td className="p-2 font-mono">1 hour (refreshable via GET)</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-sm font-semibold text-foreground mb-2">Complexity Scoring</h3>
              <p className="text-sm text-muted-foreground mb-3">Each document gets a score based on size. Total batch score max: <strong className="text-foreground">10</strong>.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-foreground">Content Size</th>
                      <th className="text-left p-2 text-foreground">Score</th>
                      <th className="text-left p-2 text-foreground">Example</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border"><td className="p-2">{'< 50 KB'}</td><td className="p-2 font-mono">1</td><td className="p-2">Short invoice, receipt</td></tr>
                    <tr className="border-b border-border"><td className="p-2">50 KB – 200 KB</td><td className="p-2 font-mono">2</td><td className="p-2">Multi-page report</td></tr>
                    <tr><td className="p-2">200 KB – 500 KB</td><td className="p-2 font-mono">4</td><td className="p-2">Large document with tables</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Example: 5 small docs = score 5 ✅ | 2 large + 1 medium = score 10 ✅ | 3 large = score 12 ❌
              </p>
            </Card>

            {/* ===== 7. LANGUAGES ===== */}
            <Card id="languages" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" /> Supported Languages
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Set <code className="bg-muted px-1 rounded">language</code> in your POST request. Click any code to copy it.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {languages.map((lang) => (
                  <div key={lang.code} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                    <CopyBadge text={lang.code} label={`Language code: ${lang.code}`} />
                    <span className="text-muted-foreground">{lang.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded text-xs text-muted-foreground">
                <strong className="text-foreground">⚠️ Note:</strong> API uses built-in PDF fonts which work best with Latin-script languages. For non-Latin scripts (Hindi, Arabic, Chinese, etc.), use the <Link to="/app" className="text-primary hover:underline">website UI</Link> for full Unicode support.
              </div>
            </Card>

            {/* ===== 8. TEMPLATES ===== */}
            <Card id="templates" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Available Templates
              </h2>
              <p className="text-sm text-muted-foreground mb-3">Click any template name to copy it. Used with <code className="bg-muted px-1 rounded">template</code> field in POST requests.</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {templates.map((t) => (
                  <CopyBadge key={t} text={t} label={`Template: ${t}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Templates are ignored when <code className="bg-muted px-1 rounded">use_raw_html: true</code>.
              </p>
            </Card>

            {/* ===== 9. CHOOSING THE RIGHT MODE ===== */}
            <Card id="choosing-mode" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" /> Choosing the Right Mode
              </h2>
              <div className="space-y-3 mb-6">
                {[
                  { icon: "📄", title: "Want a quick, styled PDF?", desc: "→ Use Template Mode (default). Send HTML structure, template handles styling." },
                  { icon: "🎨", title: "Want custom colors, fonts, layout?", desc: "→ Use Custom HTML Mode (use_raw_html: true). Full design control." },
                  { icon: "📝", title: "Just plain text, no styling?", desc: "→ Either mode works. Template Mode adds nice formatting automatically." },
                  { icon: "🖼️", title: "Converting images to PDF?", desc: "→ Use the Image to PDF feature. Upload images, get a single PDF." },
                  { icon: "🤖", title: "Building automation with custom designs?", desc: "→ Use Custom HTML Mode. Build HTML+CSS programmatically, API converts to PDF." },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-foreground mb-2">Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-foreground">Feature</th>
                      <th className="text-left p-2 text-foreground">Template Mode</th>
                      <th className="text-left p-2 text-foreground">Custom HTML Mode</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border"><td className="p-2 font-medium text-foreground">Parameter</td><td className="p-2"><code className="bg-muted px-1 rounded">use_raw_html: false</code></td><td className="p-2"><code className="bg-muted px-1 rounded">use_raw_html: true</code></td></tr>
                    <tr className="border-b border-border"><td className="p-2 font-medium text-foreground">Styling</td><td className="p-2">Automatic (from template)</td><td className="p-2">Manual (your CSS)</td></tr>
                    <tr className="border-b border-border"><td className="p-2 font-medium text-foreground">Header/Footer</td><td className="p-2">✅ Added automatically</td><td className="p-2">❌ Not added</td></tr>
                    <tr className="border-b border-border"><td className="p-2 font-medium text-foreground">CSS support</td><td className="p-2">❌ Ignored</td><td className="p-2">✅ Inline + &lt;style&gt;</td></tr>
                    <tr className="border-b border-border"><td className="p-2 font-medium text-foreground">Flexbox / Grid</td><td className="p-2">❌</td><td className="p-2">❌ (jsPDF limitation)</td></tr>
                    <tr><td className="p-2 font-medium text-foreground">Best for</td><td className="p-2">Quick docs, invoices</td><td className="p-2">Branded designs, automation</td></tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ===== 10. PAGE BREAKS ===== */}
            <Card id="page-breaks" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Page Breaks
              </h2>
              <div className="space-y-4">
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">🔄 Automatic Page Breaks</h3>
                  <p className="text-sm text-muted-foreground">Content automatically splits across pages. No limit on pages. Each page gets a footer (<code className="bg-muted px-1 rounded">Page 1/5</code>). Works in both modes.</p>
                </div>
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">✋ Manual Page Breaks</h3>
                  <p className="text-sm text-muted-foreground mb-3">CSS <code className="bg-muted px-1 rounded">page-break-after</code> is not supported. To control pages, split content into separate items in the <code className="bg-muted px-1 rounded">documents</code> array (each becomes a separate PDF file).</p>
                </div>
              </div>
            </Card>

            {/* ===== 11. RATE LIMITS ===== */}
            <Card id="ratelimits" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-primary" /> Rate Limits
              </h2>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-foreground">Auth Type</th>
                      <th className="text-left p-2 text-foreground">Limit</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border"><td className="p-2">API Key</td><td className="p-2 font-mono">60 requests/minute per key</td></tr>
                    <tr><td className="p-2">Website (JWT)</td><td className="p-2 font-mono">10 requests / 5 minutes</td></tr>
                  </tbody>
                </table>
              </div>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>GET requests to <code className="bg-muted px-1 rounded">/get-documents</code> are not rate-limited</li>
                <li>429 responses include a <code className="bg-muted px-1 rounded">retry_after</code> field (seconds)</li>
                <li>Usage tracked in real-time on <Link to="/settings" className="text-primary hover:underline">Settings</Link></li>
              </ul>
            </Card>

            {/* ===== 12. CODE EXAMPLES ===== */}
            <div id="examples" className="mb-6">
              <h2 className="text-xl font-bold font-display text-foreground mb-4 flex items-center gap-2">
                <Code className="w-5 h-5 text-primary" /> Code Examples
              </h2>

              <Card className="p-6 mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Generate PDF (Full Example)</h3>
                <CodeSwitcher entries={[
                  { language: "curl", label: "cURL", code: `curl -X POST '${functionsBaseUrl}/generate-pdf' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -d '{
    "documents": [
      {"title": "Invoice #42", "content": "<h1>Invoice</h1><p>Amount: $500</p>"},
      {"title": "Receipt", "content": "<p>Payment received. Thank you!</p>"}
    ],
    "language": "en",
    "template": "professional",
    "page_size": "A4"
  }'` },
                  { language: "javascript", label: "JavaScript", code: `const response = await fetch('${functionsBaseUrl}/generate-pdf', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    documents: [
      { title: 'Invoice #42', content: '<h1>Invoice</h1><p>Amount: $500</p>' },
      { title: 'Receipt', content: '<p>Payment received. Thank you!</p>' }
    ],
    language: 'en',
    template: 'professional',
    page_size: 'A4'
  })
});

const data = await response.json();
if (data.success) {
  for (const doc of data.documents) {
    console.log(\`📄 \${doc.title} — \${doc.download_url}\`);

    // Download the PDF
    const pdfResp = await fetch(doc.download_url);
    const blob = await pdfResp.blob();
    // Save or process the blob
  }
}` },
                  { language: "python", label: "Python", code: `import requests

API_KEY = 'YOUR_API_KEY'
BASE_URL = '${functionsBaseUrl}'

response = requests.post(
    f'{BASE_URL}/generate-pdf',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_KEY}'
    },
    json={
        'documents': [
            {'title': 'Invoice #42', 'content': '<h1>Invoice</h1><p>Amount: $500</p>'},
            {'title': 'Receipt', 'content': '<p>Payment received. Thank you!</p>'}
        ],
        'language': 'en',
        'template': 'professional',
        'page_size': 'A4'
    }
)

data = response.json()
if data.get('success'):
    for doc in data['documents']:
        print(f"📄 {doc['title']} — {doc['download_url']}")
        pdf = requests.get(doc['download_url'])
        with open(doc['title'] + '.pdf', 'wb') as f:
            f.write(pdf.content)
        print("   ✅ Saved!")` },
                  { language: "php", label: "PHP", code: `<?php
$apiKey = 'YOUR_API_KEY';
$baseUrl = '${functionsBaseUrl}';

$ch = curl_init("$baseUrl/generate-pdf");
$payload = json_encode([
    'documents' => [
        ['title' => 'Invoice #42', 'content' => '<h1>Invoice</h1><p>Amount: $500</p>'],
    ],
    'language' => 'en',
    'template' => 'professional',
    'page_size' => 'A4'
]);

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        "Authorization: Bearer $apiKey"
    ],
    CURLOPT_RETURNTRANSFER => true,
]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response['success']) {
    foreach ($response['documents'] as $doc) {
        echo "📄 {$doc['title']}\\n";
        file_put_contents($doc['title'] . '.pdf', file_get_contents($doc['download_url']));
    }
}` },
                  { language: "go", label: "Go", code: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

const apiKey = "YOUR_API_KEY"
const baseURL = "${functionsBaseUrl}"

func main() {
    payload := map[string]interface{}{
        "documents": []map[string]string{
            {"title": "Invoice #42", "content": "<h1>Invoice</h1><p>Amount: $500</p>"},
        },
        "language": "en",
        "template": "professional",
        "page_size": "A4",
    }
    body, _ := json.Marshal(payload)

    req, _ := http.NewRequest("POST", baseURL+"/generate-pdf", bytes.NewBuffer(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+apiKey)

    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)

    docs := result["documents"].([]interface{})
    for _, d := range docs {
        doc := d.(map[string]interface{})
        fmt.Printf("📄 %s\\n", doc["title"])
        pdfResp, _ := http.Get(doc["download_url"].(string))
        defer pdfResp.Body.Close()
        f, _ := os.Create(doc["title"].(string) + ".pdf")
        io.Copy(f, pdfResp.Body)
        f.Close()
    }
}` },
                ]} />
              </Card>

              <Card className="p-6 mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Invoice Generation (from Data)</h3>
                <CodeSwitcher entries={[
                  { language: "python", label: "Python", code: `import requests

API_KEY = 'YOUR_API_KEY'
BASE_URL = '${functionsBaseUrl}'

invoice = {
    "number": "INV-2026-042",
    "customer": "Acme Corp",
    "items": [
        {"name": "Widget Pro", "qty": 10, "price": 49.99},
        {"name": "Gadget Plus", "qty": 5, "price": 29.99},
    ],
    "due_date": "April 15, 2026"
}

total = 0
rows = ""
for item in invoice["items"]:
    subtotal = item["qty"] * item["price"]
    total += subtotal
    rows += f"<tr><td>{item['name']}</td><td>{item['qty']}</td><td>\${item['price']:.2f}</td><td>\${subtotal:.2f}</td></tr>"

content = f"""
<h1>Invoice {invoice['number']}</h1>
<p><strong>Customer:</strong> {invoice['customer']}</p>
<p><strong>Due:</strong> {invoice['due_date']}</p>
<table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>{rows}</table>
<p><strong>Total: \${total:.2f}</strong></p>
"""

response = requests.post(
    f'{BASE_URL}/generate-pdf',
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {API_KEY}'},
    json={'documents': [{'title': f'Invoice_{invoice["number"]}', 'content': content}], 'template': 'professional', 'page_size': 'A4'}
)

data = response.json()
if data.get('success'):
    pdf = requests.get(data['documents'][0]['download_url'])
    with open('invoice.pdf', 'wb') as f:
        f.write(pdf.content)
    print("✅ Invoice saved!")` },
                  { language: "javascript", label: "JavaScript", code: `const API_KEY = 'YOUR_API_KEY';
const BASE_URL = '${functionsBaseUrl}';

const invoice = {
  number: 'INV-2026-042',
  customer: 'Acme Corp',
  items: [
    { name: 'Widget Pro', qty: 10, price: 49.99 },
    { name: 'Gadget Plus', qty: 5, price: 29.99 },
  ],
  dueDate: 'April 15, 2026'
};

let total = 0;
const rows = invoice.items.map(item => {
  const sub = item.qty * item.price;
  total += sub;
  return \`<tr><td>\${item.name}</td><td>\${item.qty}</td><td>$\${item.price.toFixed(2)}</td><td>$\${sub.toFixed(2)}</td></tr>\`;
}).join('');

const content = \`
<h1>Invoice \${invoice.number}</h1>
<p><strong>Customer:</strong> \${invoice.customer}</p>
<p><strong>Due:</strong> \${invoice.dueDate}</p>
<table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>\${rows}</table>
<p><strong>Total: $\${total.toFixed(2)}</strong></p>
\`;

const response = await fetch(\`\${BASE_URL}/generate-pdf\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${API_KEY}\` },
  body: JSON.stringify({
    documents: [{ title: \`Invoice_\${invoice.number}\`, content }],
    template: 'professional', page_size: 'A4'
  })
});

const data = await response.json();
if (data.success) {
  const pdf = await fetch(data.documents[0].download_url);
  // Save or process the PDF blob
  console.log("✅ Invoice generated!");
}` },
                ]} />
              </Card>

              <Card className="p-6 mb-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">List & Get Documents</h3>
                <CodeSwitcher entries={[
                  { language: "curl", label: "cURL", code: `# List documents
curl -X GET '${functionsBaseUrl}/get-documents?limit=10&offset=0' \\
  -H 'Authorization: Bearer YOUR_API_KEY'

# Get single document
curl -X GET '${functionsBaseUrl}/get-documents?id=YOUR_DOCUMENT_ID' \\
  -H 'Authorization: Bearer YOUR_API_KEY'` },
                  { language: "javascript", label: "JavaScript", code: `// List documents
const listResp = await fetch(
  '${functionsBaseUrl}/get-documents?limit=10&offset=0',
  { headers: { 'Authorization': 'Bearer YOUR_API_KEY' } }
);
const listData = await listResp.json();
console.log('Total:', listData.pagination.total);
listData.documents.forEach(doc => {
  console.log(\`  \${doc.title} — \${doc.download_url ? '✅' : '❌'}\`);
});

// Get single document
const docResp = await fetch(
  \`${functionsBaseUrl}/get-documents?id=YOUR_DOCUMENT_ID\`,
  { headers: { 'Authorization': 'Bearer YOUR_API_KEY' } }
);
const docData = await docResp.json();
console.log('Download:', docData.document.download_url);` },
                  { language: "python", label: "Python", code: `import requests

API_KEY = 'YOUR_API_KEY'

# List documents
list_resp = requests.get(
    '${functionsBaseUrl}/get-documents?limit=10&offset=0',
    headers={'Authorization': f'Bearer {API_KEY}'}
)
list_data = list_resp.json()
print(f"Total: {list_data['pagination']['total']}")
for doc in list_data['documents']:
    print(f"  {doc['title']} — {'✅' if doc.get('download_url') else '❌'}")

# Get single document
doc_resp = requests.get(
    f'${functionsBaseUrl}/get-documents?id=YOUR_DOCUMENT_ID',
    headers={'Authorization': f'Bearer {API_KEY}'}
)
doc_data = doc_resp.json()
print(f"Download: {doc_data['document']['download_url']}")` }
                ]} />
              </Card>
            </div>

            {/* ===== 13. ERROR CODES ===== */}
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">Error Codes</h2>
              <div className="space-y-2 text-sm">
                {[
                  { code: 400, error: "INVALID_INPUT", desc: "Missing/invalid documents, title/content validation failed" },
                  { code: 400, error: "BATCH_TOO_COMPLEX", desc: "Total complexity score exceeds 10" },
                  { code: 400, error: "CONTENT_TOO_COMPLEX", desc: "Document has >50 tables or >5000 HTML tags" },
                  { code: 401, error: "INVALID_KEY", desc: "Missing, invalid or revoked API key" },
                  { code: 404, error: "NOT_FOUND", desc: "Document ID not found" },
                  { code: 405, error: "METHOD_NOT_ALLOWED", desc: "Wrong HTTP method" },
                  { code: 408, error: "GENERATION_TIMEOUT", desc: "Rendering exceeded 30s timeout" },
                  { code: 413, error: "PAYLOAD_TOO_LARGE", desc: "Request body exceeds 5MB" },
                  { code: 429, error: "RATE_LIMITED", desc: "Rate limit exceeded" },
                  { code: 500, error: "GENERATION_FAILED", desc: "Internal server error" },
                ].map((e) => (
                  <div key={e.error} className="flex items-start gap-3 p-3 rounded bg-muted/50">
                    <span className="font-mono font-bold text-foreground shrink-0 w-8">{e.code}</span>
                    <span className="font-mono text-primary shrink-0 w-44">{e.error}</span>
                    <span className="text-muted-foreground">{e.desc}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* ===== 14. BEST PRACTICES ===== */}
            <Card id="bestpractices" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" /> Best Practices
              </h2>
              <div className="space-y-4 text-sm text-muted-foreground">
                {[
                  { title: "Keep content under 50KB for fastest generation", desc: "Documents under 50KB get score 1, allowing 5 per batch." },
                  { title: "Avoid deeply nested tables", desc: "Over 50 tables per document will be rejected. Keep structures simple." },
                  { title: "Download URLs immediately", desc: "URLs expire in 1 hour. Use GET /get-documents?id=ID to refresh." },
                  { title: "Batch documents wisely", desc: "Up to 5 per request. Check complexity scoring." },
                  { title: "Handle errors & rate limits", desc: "Check 'success' field. For 429, use 'retry_after'. Implement exponential backoff for 500s." },
                  { title: "Rotate API keys", desc: "Use descriptive names, rotate periodically. Revoke unused keys." },
                  { title: "Set correct language", desc: "Use the language parameter for non-Latin scripts." },
                ].map(item => (
                  <div key={item.title}>
                    <h3 className="font-medium text-foreground mb-1">{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* ===== 15. FAQ ===== */}
            <Card id="faq" className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary" /> FAQ & Troubleshooting
              </h2>
              <div className="space-y-4">
                {[
                  { q: "My Hindi/Arabic/Chinese text doesn't render correctly", a: "The API uses built-in PDF fonts for Latin scripts. For non-Latin, use the website UI at /app which renders client-side with full Unicode support." },
                  { q: "My content shows as one long line", a: "Use \\n for line breaks in cURL. In Python/JS, use multiline strings. For better formatting, use HTML tags (<p>, <br>)." },
                  { q: "How do I control page breaks?", a: "Page breaks are automatic. For manual control, split content into separate items in the documents array (each becomes a separate PDF)." },
                  { q: "Documents array items vs pages?", a: "Each item in documents[] = separate PDF file. Pages within a PDF are created automatically when content overflows." },
                  { q: "My CSS styles aren't working", a: "Set \"use_raw_html\": true. Without it, CSS is ignored. Only inline styles and <style> blocks work. No Flexbox/Grid." },
                  { q: "When should use_raw_html be true?", a: "When you want custom colors/fonts/styling, building automation with custom HTML, or don't want template headers/footers." },
                  { q: "BATCH_TOO_COMPLEX error?", a: "Total complexity exceeds 10. Score: <50KB=1, 50-200KB=2, 200-500KB=4. Reduce sizes or send fewer docs." },
                  { q: "Download URL stopped working?", a: "URLs expire after 1 hour. Use GET /get-documents?id=DOC_ID for a fresh URL." },
                  { q: "How many images can I convert?", a: "API: max 20 images. Web UI: 100+ images. The web UI processes client-side for maximum speed." },
                ].map((item, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <h3 className="text-sm font-medium text-foreground mb-2">❓ {item.q}</h3>
                    <p className="text-sm text-muted-foreground">{item.a}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Docs;
