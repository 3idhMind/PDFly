# PDFly

**PDF tools that run in your browser, and a REST API for everything else.**

The web tools process files on your own device — nothing is uploaded, there is no size
limit, and no account is needed. The API exists for scripts and servers, where a file
genuinely has to reach one.

[Live site](https://pdfly.3idhmind.in) ·
[API docs](https://pdfly.3idhmind.in/docs) ·
[Pricing](https://pdfly.3idhmind.in/pricing) ·
[Contributing](CONTRIBUTING.md) ·
[Security](SECURITY.md)

---

## Contents

- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)

---

## How it works

There are two paths through this product, and the difference matters more than any
feature list.

### 1. The browser tools — the default

```
Your file  ──▶  pdf-lib / pdf.js in your tab  ──▶  your download
                        (never leaves the device)
```

Every tool at `/merge-pdf`, `/split-pdf`, `/compress-pdf` and the rest runs entirely in
your browser. There is no upload, so there is no size limit, no queue and no account.
This is also why the tools are free: your device does the work, so there is no server
bill that grows with usage.

### 2. The server fallback — only with consent

A phone with 2 GB of RAM cannot merge a 300-page scan. Rather than crash, the app
measures what the device can actually handle (`src/lib/deviceCapability.ts`), and when a
job is too large it **asks first**. Only after the visitor agrees does the file go to the
API, get processed, and come back.

### 3. The REST API

```
POST /api/pdf/upload      3 MB parts  ──▶  object storage  ──▶  signed "ref:"
POST /api/pdf/basic/merge { "pdfs": ["ref:…"] }  ──▶  processed  ──▶  link or inline
```

Vercel refuses a request body over ~4.5 MB before any code runs. That is a limit on the
pipe, not on the function — the same function has 2 GB of memory and five minutes. So
large files arrive in parts and are stitched in storage, and the operation resolves them
server-side. Generated files are kept for **one hour** behind a signed link on our own
domain, then deleted for real. See [`_internal`](#project-structure) D-030 for the full
reasoning.

---

## Features

### PDF and image tools (browser, free, no account)

| Tool | What it does |
|------|--------------|
| Merge PDF | Combine PDFs in any order |
| Split PDF | Extract pages, ranges, or split every N pages |
| Compress PDF | Reduce file size, with exact-KB targets |
| PDF to images | Every page as PNG or JPG, zipped |
| Images to PDF | 25+ formats including HEIC, TIFF, RAW |
| Text to PDF | 15 templates, Markdown and HTML input |
| Rotate / Delete / Reorder pages | Page-level editing |
| Resize image to KB | Hit an exact size target for exam portals |
| ID photo crop | Aadhaar, PAN and Voter ID dimensions |

### REST API

- Generate, merge, split, compress, and convert in both directions
- Chunked upload for files past the platform body cap
- Signed download links on our own domain, never on the storage vendor's
- Per-key rate limits and a monthly quota, both returning real error codes

### Script support

Latin, **Devanagari** (Hindi, Marathi, Sanskrit, Nepali) and **Arabic script** (Arabic,
Persian, Urdu) render on both the browser tools and the API — the matching Noto font is
embedded on demand. Arabic renders correct glyphs but without bidirectional reordering,
so letters appear in separated forms.

**Chinese, Japanese, Korean, Hebrew and Thai are not supported.** The API returns a
warning rather than silently producing broken output, and the browser tool does not offer
them in the language picker.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Build | Vite 5 |
| Auth & database | Firebase Authentication, Cloud Firestore |
| API | Vercel Functions (Node.js), namespaced under `api/` |
| PDF engine | pdf-lib and jsPDF (both browser and server), pdf.js for rasterising |
| Object storage | Pluggable adapter — Filen today, S3-compatible also implemented |
| Animation | Framer Motion |

---

## Quick start

**Prerequisites**

- Node.js 22 (the test scripts rely on native TypeScript type stripping)
- A [Firebase](https://firebase.google.com) project on the free tier, with
  **Authentication → Google** enabled and **Cloud Firestore** created

The browser tools need none of this. Firebase is only for sign-in and API keys.

```bash
git clone https://github.com/devvaham/PDFly.git
cd PDFly
npm install
cp .env.example .env    # then fill in the Firebase values
npm run dev
```

The app runs at `http://localhost:8080`.

Firestore rules and indexes are deployed once:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

---

## Environment variables

`.env.example` documents every variable with its reasoning. The summary:

### Client — compiled into the browser bundle, public by design

Firebase web config is not a secret; access is controlled by Firestore rules.

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_FIREBASE_API_KEY` | yes | |
| `VITE_FIREBASE_AUTH_DOMAIN` | yes | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | yes | |
| `VITE_FIREBASE_STORAGE_BUCKET` | yes | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | yes | |
| `VITE_FIREBASE_APP_ID` | yes | |
| `VITE_SITE_URL` | **leave blank** | Only for a staging domain. The app uses the browser's own origin, which is correct everywhere. A localhost value is ignored on purpose — see `src/lib/config.ts`. |

### Server — real secrets, set in the Vercel dashboard

| Variable | Required | Notes |
|----------|----------|-------|
| `FIREBASE_PROJECT_ID` | yes | Service account |
| `FIREBASE_CLIENT_EMAIL` | yes | Service account |
| `FIREBASE_PRIVATE_KEY` | yes | Keep the `\n` escapes |
| `ADMIN_EMAIL` | no | Comma-separated. Whoever is listed is the admin; deliberately not `VITE_`-prefixed so it never reaches the browser. |
| `PDFLY_FREE_TIER_MONTHLY_QUOTA` | no | Defaults in `api/_lib/firebase.ts` |
| `PDFLY_RATE_LIMIT_PER_MIN` | no | Per-key default |
| `CRON_SECRET` | recommended | Vercel sends it on scheduled runs. Without it, the retention sweep route is unauthenticated. |

### Object storage — optional; without it the API returns files inline only

| Variable | Notes |
|----------|-------|
| `FILEN_EMAIL`, `FILEN_PASSWORD`, `FILEN_2FA_CODE` | Filen adapter. Use a dedicated account: these credentials grant the whole account, not one scoped bucket. |
| `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_ENDPOINT`, `STORAGE_REGION` | S3-compatible adapter (B2 / R2 / S3). Used only when `FILEN_EMAIL` is blank; all must be set together. |
| `STORAGE_URL_TTL_SECONDS` | How long a file stays downloadable before it is deleted. Default 3600. |
| `PUBLIC_BASE_URL` | Domain download links are built on. Always ours, never the vendor's. |
| `FILE_TOKEN_SECRET` | Signs download tokens. Falls back to the Firebase private key, so a missing value cannot silently produce forgeable links. |

---

## Project structure

```
src/
├── components/          React components
│   └── ui/              shadcn/ui primitives (generated; excluded from lint)
├── hooks/               Custom hooks
├── lib/
│   ├── firebase/        Client, auth and Firestore helpers
│   ├── pdfTools/        Browser-side PDF operations
│   ├── imageTools/      Browser-side image operations
│   ├── cloudFallback.ts Chunked upload + server fallback client
│   ├── deviceCapability.ts  Measures what this device can handle locally
│   ├── config.ts        Canonical origin for every SEO tag
│   ├── routeMeta.ts     Single source of truth for per-route metadata
│   └── apiSpec.ts       Single source of truth for the public API docs
├── pages/               Route components
└── types/

api/                     Vercel Functions — one file per namespace
├── account.ts           /me, /keys, /documents
├── admin.ts             /feedback, /events, /activity, /blog
├── blog.ts              Blog read and publish
├── file.ts              /api/file/<token> — signed download, streamed
├── pdf.ts               Every PDF operation, plus /upload
├── system.ts            Health probe and the retention sweep
└── _lib/                Shared code; the underscore keeps Vercel from
    ├── handlers/        routing to it. One handler per operation.
    ├── storage.ts       Provider interface, delivery, retention sweep
    ├── tiers.ts         Per-tier ceilings, in one table
    ├── pdfInput.ts      SSRF guard, magic bytes, upload-ref resolution
    └── ...

scripts/
├── postbuild.mjs        Prerenders every route and writes sitemap.xml
├── smoke-api.mjs        Proves every function loads and every route answers
├── route-test.mjs       Checks the prerendered HTML
├── storage-test.mjs     Offline S3 signing check
├── retention-live-test.mjs   End-to-end delete check (needs real credentials)
└── humanize-check.mjs   Pre-publish content check

_internal/               Planning, decisions and strategy. NOT published.
```

**Functions are grouped by namespace on purpose.** Vercel's Hobby plan allows twelve
serverless functions per deployment, and one file per endpoint had already caused a failed
deploy. Each file under `api/` is one function; adding an operation is a line in that
file's route table, not a new slot.

### A note on `sitemap.xml`

There is no `sitemap.xml` in this repository, and that is intentional. It is generated at
build time by `scripts/postbuild.mjs` from `src/lib/routeMeta.ts` and written to
`dist/sitemap.xml`. A hand-maintained one drifted out of sync with the real routes;
generating it removes that failure mode.

Routes marked `noindex` are prerendered but deliberately excluded from the sitemap, so the
two counts do not match and should not.

Adding a route means adding it to `src/lib/routeMeta.ts` **and** `src/App.tsx`.

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server on port 8080 |
| `npm run build` | Production build, then prerender and sitemap |
| `npm run lint` | ESLint, zero tolerance — the gate expects no errors |
| `npm run typecheck` | Both the app and the API projects |
| `npm test` | API-key security checks, upload and tier checks |
| `npm run smoke` | Loads every function and drives every route |
| `npm run routes` | Verifies the prerendered HTML |
| **`npm run verify`** | **All of the above. Run this before every push.** |

`npm run verify` is not optional discipline. This project shipped broken to production
four separate times because "typecheck passes" was mistaken for "it works" — catch-all
routing, ESM/CJS conflicts and module-load failures are none of them type errors, and the
smoke and route steps exist specifically to catch those.

Two checks are deliberately outside the gate because they need real credentials and
network access:

```bash
node scripts/retention-live-test.mjs   # proves files are really deleted after the TTL
node scripts/humanize-check.mjs <file> # content check before publishing a post
```

---

## Deployment

Production runs on Vercel.

1. Connect the repository to [Vercel](https://vercel.com)
2. Add every `VITE_FIREBASE_*` variable, and leave `VITE_SITE_URL` unset
3. Add the server secrets so the functions can reach Firebase Admin
4. Add `CRON_SECRET` so the retention sweep route is not public
5. Add the storage credentials if you want files to be retrievable after the response
6. Add your domain to Firebase → Authentication → Settings → **Authorised domains**, or
   Google sign-in fails in production

The daily cron in `vercel.json` is a backstop for the retention sweep, not the mechanism:
Hobby crons run at daily granularity and retention is one hour, so the real sweep is
triggered opportunistically by traffic.

> **Verify a prerender with `npx serve dist`, not `vite preview`.** `vite preview`
> SPA-rewrites every path, so a broken prerender still looks fine. `serve` checks the
> filesystem first, which is what Vercel does.

The static front end runs on any host with SPA fallback. The `api/` endpoints are Vercel
Functions and would need porting elsewhere.

---

## Security

- API keys are hashed with SHA-256 before storage. The raw key is shown once and cannot be
  recovered afterwards, by the user or by us.
- Browser tools never upload. The server path runs only after an explicit consent step.
- Every endpoint that fetches a URL on the caller's behalf goes through one shared SSRF
  guard that checks the hostname *and* every address it resolves to, and refuses
  redirects.
- Download links are HMAC-signed with an embedded expiry and carry no database lookup.
  Invalid, tampered and expired tokens all answer 404 so probing cannot tell them apart.
- Firestore rules restrict every collection to its owner.

Report a vulnerability via [SECURITY.md](SECURITY.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: run `npm run verify` before you
open a pull request, and prefer deleting code to adding it.

## License

[MIT](LICENSE).

Built by [3idhMind](https://3idhmind.in).
