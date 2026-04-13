# PDFly — Universal PDF Generator & Image to PDF

<p align="center">
  <strong>Generate beautiful PDFs in 70+ languages or convert 100+ images to PDF — Free, Open Source</strong>
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
- **70+ Languages** — Hindi, Arabic, Chinese, Japanese, Korean, Hinglish, Tamil, Telugu, Bengali, and more with automatic font selection
- **15 Professional Templates** — Minimal, Professional, Creative, Modern, Classic, Elegant, Bold, Tech, Academic, Corporate, Artistic, Clean, Vibrant, Dark, Light
- **Full RTL Support** — Arabic, Hebrew, Urdu, Persian with bidirectional text rendering
- **HTML & Markdown** — Send raw HTML with CSS or plain text. Tables, headings, images, custom styles
- **Batch Generation** — Generate up to 10 PDFs in a single API request

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
| Backend | Supabase (Auth, Database, Edge Functions, Storage) |
| PDF Engine | jsPDF (client-side), Edge Functions (server-side) |
| Image Processing | Canvas API, heic2any |
| Animations | Framer Motion |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or bun
- A [Supabase](https://supabase.com) project (free tier works)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/3idhMind/pdfly.git
cd pdfly

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start development server
npm run dev
```

The app runs at `http://localhost:8080`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | ✅ | Supabase project reference ID |
| `VITE_SITE_URL` | ❌ | Your primary production URL (for production use `https://pdfly.3idhmind.in`) |

### Database Setup

Run the Supabase migrations to create required tables:

```bash
npx supabase db push
```

Or manually apply migrations from `supabase/migrations/`.

## 📁 Project Structure

```
src/
├── assets/              # Static images
├── components/          # Reusable components
│   └── ui/              # shadcn/ui primitives
├── hooks/               # Custom React hooks
├── integrations/        # Supabase client setup
├── lib/
│   ├── config.ts        # Site configuration (SITE_URL)
│   ├── imageConverter.ts # Image-to-PDF conversion logic
│   ├── pdfGenerator.ts  # Text-to-PDF generation
│   └── utils.ts         # Utility functions
├── pages/               # Route pages
└── types/               # TypeScript types

supabase/
├── config.toml          # Supabase project config
├── functions/           # Edge functions
│   ├── generate-pdf/    # Text/HTML to PDF API
│   ├── images-to-pdf/   # Image to PDF API
│   ├── get-documents/   # Document retrieval
│   ├── health-check/    # Health monitoring
│   └── ...
└── migrations/          # Database migrations
```

## 🌐 Deployment

### Lovable (Recommended)

This project is built on [Lovable](https://lovable.dev). Click **Publish** in the editor to deploy instantly.

### Vercel

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, and `VITE_SITE_URL` in Vercel
3. Set `VITE_SITE_URL` to your production domain (`https://pdfly.3idhmind.in`)
4. Deploy — the included `vercel.json` handles SPA routing

### Other Platforms

Any static hosting that supports SPA fallback works:
- **Netlify** — Add `public/_redirects`: `/* /index.html 200`
- **Cloudflare Pages** — SPA mode is automatic
- **GitHub Pages** — Use a 404.html redirect trick

## 🔒 Security

- API keys are hashed with SHA-256 before storage
- Image processing is 100% client-side — no server uploads
- Edge functions validate all inputs and enforce rate limits
- Row Level Security (RLS) on all database tables

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🙏 Credits

Built by [3idhMind](https://3idhmind.in) • Powered by [Lovable](https://lovable.dev) & [Supabase](https://supabase.com)
