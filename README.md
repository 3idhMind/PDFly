# PDFly — Private PDF Tools & Free API

<p align="center">
  <strong>Merge, split, compress and convert PDFs entirely in your browser. Your files are never uploaded. Free and open source.</strong>
</p>

<p align="center">
  <a href="https://pdfly.3idhmind.in">Live Demo</a> •
  <a href="https://pdfly.3idhmind.in/docs">API Docs</a> •
  <a href="#features">Features</a> •
  <a href="#getting-started">Setup</a> •
  <a href="#deployment">Deploy</a> •
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

---

## ✨ Features

### 📝 Text to PDF
- **15 Professional Templates** — Minimal, Professional, Creative, Modern, Classic, Elegant, Bold, Tech, Academic, Corporate, Artistic, Clean, Vibrant, Dark, Light
- **Non-Latin scripts in the browser tool** — the web app detects the script and loads a matching Noto font on demand. Devanagari (Hindi, Marathi, Sanskrit, Nepali) and Arabic script (Arabic, Persian, Urdu) are covered today. Latin-script languages work everywhere with the built-in fonts. CJK (Chinese, Japanese, Korean) is not covered on either surface: jsPDF cannot parse the OTF/CFF Noto CJK fonts, so that text falls back to Latin.
  <br>**The REST API is Latin-only.** It renders with the built-in Helvetica and does not embed fonts, so non-Latin text sent to the API will not render correctly. Use the browser tool for those scripts. ([tracked issue](#roadmap))
- **HTML & Markdown** — Send raw HTML with CSS or plain text. Tables, headings, images, custom styles
- **Batch Generation** — Generate up to 5 PDFs in a single API request

### 🖼️ Image to PDF
- **25+ Image Formats** — JPEG, PNG, WebP, HEIC/HEIF, TIFF, GIF, BMP, SVG, AVIF, PSD, RAW (CR2, NEF, ARW, DNG, ORF, RW2, RAF, PEF, SR2, SRW), and more
- **100+ Images Per PDF** — No artificial limits on image count
- **Client-Side Processing** — Images never leave your device. All conversion happens in the browser
- **Drag & Drop Reorder** — Arrange images in any order before conversion
- **Customizable Settings** — Page size, orientation, fit mode, quality adjustment

### 🔌 REST API
- **Free API Access** — No credit card required
- **Code Examples** — JavaScript, Python, PHP, Go, cURL
- **Batch Processing** — Multiple documents per request
- **Rate Limiting** — Built-in protection with generous limits

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Build | Vite 5 |
| Auth & Database | Firebase Authentication (Google sign-in), Cloud Firestore |
| API | Vercel Functions (Node.js) under `api/` |
| PDF Engine | jsPDF + pdf-lib (client-side), Vercel Functions (server-side) |
| Image Processing | Canvas API, heic2any |
| Animations | Framer Motion |

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ (the build scripts rely on native TypeScript stripping)
- npm or bun
- A [Firebase](https://firebase.google.com) project (Spark/free tier works) with
  **Authentication → Google** enabled and **Cloud Firestore** created

Note: the browser PDF tools need none of this — they run fully client-side. Firebase is
only required for sign-in and API-key management.

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/3idhMind/pdfly.git
cd pdfly

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your Firebase credentials

# 4. Start development server
npm run dev
```

The app runs at `http://localhost:8080`.

### Environment Variables

**Client** (`VITE_`-prefixed — these are compiled into the browser bundle and are public by
design; Firebase web config is not a secret, access is controlled by Firestore rules):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Cloud Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | ✅ | Firebase app ID |
| `VITE_SITE_URL` | ❌ | Primary production URL (production: `https://pdfly.3idhmind.in`) |

**Server** (Vercel Functions only — **real secrets, never `VITE_`-prefixed**, set these in the
Vercel dashboard, not in a committed file):

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_PROJECT_ID` | ✅ | Service-account project ID |
| `FIREBASE_CLIENT_EMAIL` | ✅ | Service-account email |
| `FIREBASE_PRIVATE_KEY` | ✅ | Service-account private key (keep the `\n` escapes) |
| `PDFLY_RATE_LIMIT_PER_MIN` | ❌ | Per-key rate limit (default in `api/_lib/quota.ts`) |
| `PDFLY_FREE_TIER_MONTHLY_QUOTA` | ❌ | Monthly free-tier quota |

### Database Setup

Firestore needs its rules and indexes deployed once:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

Both files (`firestore.rules`, `firestore.indexes.json`) are in the repo root.

## 📁 Project Structure

```
src/
├── assets/              # Static images
├── components/          # Reusable components
│   └── ui/              # shadcn/ui primitives
├── hooks/               # Custom React hooks
├── lib/
│   ├── firebase/        # Firebase client, auth, Firestore helpers
│   ├── routeMeta.ts     # Single source of truth for per-route SEO metadata
│   ├── imageConverter.ts # Image-to-PDF conversion logic
│   ├── clientPdfGenerator.ts # Text-to-PDF generation (browser)
│   └── utils.ts         # Utility functions
├── pages/               # Route pages
└── types/               # TypeScript types

api/                     # Vercel Functions (Node.js)
├── _lib/                # Shared: auth, API keys, quota, rate limiting
├── generate-pdf.ts      # Text/HTML to PDF API
├── images-to-pdf.ts     # Image to PDF API
├── health.ts            # Health monitoring
└── ...

scripts/
└── postbuild.mjs        # Prerenders every route + generates sitemap.xml
```

### A note on `sitemap.xml`

There is **no `sitemap.xml` file in this repository, and that is intentional.** It is
generated at build time by `scripts/postbuild.mjs` from `src/lib/routeMeta.ts`, and written
to `dist/sitemap.xml`. A previously hand-maintained `public/sitemap.xml` drifted out of sync
with the real routes; generating it removes that failure mode entirely.

To see it: run `npm run build`, then open `dist/sitemap.xml`.

Adding a route means adding it to `src/lib/routeMeta.ts` **and** `src/App.tsx` — the sitemap
and the prerendered HTML then both pick it up with no further edits.

## 🌐 Deployment

### Vercel (what production runs on)

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Add every `VITE_FIREBASE_*` variable plus `VITE_SITE_URL` (see above)
3. Add the **server** secrets — `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
   `FIREBASE_PRIVATE_KEY` — so the functions under `api/` can reach Firebase Admin
4. Add your domain to Firebase → Authentication → Settings → **Authorised domains**,
   or Google sign-in will fail in production
5. Deploy. `npm run build` runs `scripts/postbuild.mjs`, which prerenders every route to a
   real HTML file and writes `dist/sitemap.xml`

### Other Platforms

The static front end works on any host with SPA fallback (Netlify, Cloudflare Pages). The
`api/` endpoints are Vercel Functions and would need porting to that host's function
runtime.

> **Verify prerendering with `npx serve dist`, not `vite preview`.** `vite preview`
> SPA-rewrites every path, so a broken prerender still looks fine. `serve` checks the
> filesystem first, which is what Vercel does.

## 🔒 Security

- API keys are hashed with SHA-256 before storage; the raw key is shown once and never persisted
- Image and PDF processing in the web tools is 100% client-side — no server uploads
- `api/` functions validate inputs, enforce per-key rate limits and monthly quotas
- Firestore security rules (`firestore.rules`) restrict every collection to its owner

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🙏 Credits

Built by [3idhMind](https://3idhmind.in) • Runs on [Vercel](https://vercel.com) & [Firebase](https://firebase.google.com)
