# Contributing to PDFly

Thank you for your interest in contributing to PDFly! This guide will help you get started.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- **npm** or **bun** package manager
- A **Supabase** project (free tier works fine)

### Local Setup

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/pdfly.git
   cd pdfly
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase credentials in `.env`:
   - `VITE_SUPABASE_URL` — Your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — Your Supabase anon/public key
   - `VITE_SUPABASE_PROJECT_ID` — Your Supabase project reference ID
   - `VITE_SITE_URL` — Your deployment URL (use `http://localhost:8080` for local dev)

4. **Start Development Server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:8080`.

## 📋 How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/3idhMind/pdfly/issues) to avoid duplicates
2. Use the **Bug Report** template
3. Include: steps to reproduce, expected vs actual behavior, browser/OS info

### Suggesting Features

1. Open a **Feature Request** issue
2. Describe the use case, not just the solution
3. Explain why this would benefit PDFly users

### Submitting Code

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines below

3. **Test your changes** — ensure the app builds without errors:
   ```bash
   npm run build
   ```

4. **Commit with clear messages**:
   ```
   feat: add PDF merge functionality
   fix: resolve HEIC conversion on Safari
   docs: update API documentation for batch endpoint
   ```

5. **Push and create a Pull Request** against `main`

## 🎨 Code Style

- **TypeScript** — All code must be typed. Avoid `any`.
- **React** — Functional components with hooks. No class components.
- **Tailwind CSS** — Use design tokens from `index.css`. Never hardcode colors.
- **Components** — Small, focused, single-responsibility. Use `src/components/ui/` for primitives.
- **Naming** — PascalCase for components, camelCase for functions/variables, kebab-case for files.

## 🏗️ Project Structure

```
src/
├── assets/          # Static images and assets
├── components/      # Reusable UI components
│   └── ui/          # shadcn/ui primitives
├── hooks/           # Custom React hooks
├── integrations/    # Supabase client and types
├── lib/             # Utility functions (PDF generation, image conversion, config)
├── pages/           # Route-level page components
└── types/           # TypeScript type definitions

supabase/
└── functions/       # Edge functions (serverless backend)
```

## 📝 Pull Request Guidelines

- Keep PRs focused — one feature/fix per PR
- Update documentation if your change affects the API or user-facing features
- Add meaningful PR description explaining *what* and *why*
- Ensure no console errors in browser dev tools

## 🔒 Security

If you discover a security vulnerability, **do NOT open a public issue**. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## 📄 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

**Questions?** Open a [Discussion](https://github.com/3idhMind/pdfly/discussions) or reach out to the maintainers.
