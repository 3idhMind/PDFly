# Contributing to PDFly

Thanks for wanting to help. This guide covers the setup, the one rule that is not
negotiable, and the conventions the codebase already follows.

---

## Setup

**Prerequisites**

- **Node.js 22.** The test scripts run `.ts` files directly and rely on Node's native
  type stripping. `engines` in `package.json` pins this.
- **npm.** The lockfile is `package-lock.json` and it is the only one — please do not
  commit a second lockfile from another package manager, because then which one the build
  actually uses stops being obvious.
- A **Firebase** project on the free tier, but only if you are working on sign-in or the
  API. The browser PDF tools run fully client-side and need no backend at all.

```bash
git clone https://github.com/YOUR_USERNAME/PDFly.git
cd PDFly
npm install
cp .env.example .env
npm run dev
```

The app runs at `http://localhost:8080`.

### Environment variables

`.env.example` documents every variable and, importantly, which ones are secrets. The
short version:

- `VITE_FIREBASE_*` (six variables) — Firebase **web** config. Compiled into the browser
  bundle and public by design; Firestore rules do the access control, not secrecy.
- `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` — the service
  account used by the `api/` functions. **Real secrets.** Never prefix these with `VITE_`,
  which would publish them to every visitor.
- `VITE_SITE_URL` — **leave it blank.** The app uses the browser's own origin, which is
  already right in development and in production. Setting it to a localhost URL used to
  compile localhost into the production bundle and make it the canonical URL of every
  page; that value is now ignored, but the variable is still best left alone.

---

## The one rule

**`npm run verify` must pass before you open a pull request.**

```bash
npm run verify
```

That runs lint, both typecheck projects, the unit checks, a storage check, an API smoke
test, a prerender route test, and the production build.

It is not ceremony. This project shipped broken to production four separate times because
"typecheck passes" was mistaken for "it works". Catch-all routing bugs, ESM/CJS conflicts
and module-load failures are none of them type errors — the smoke and route steps exist
specifically to catch the class of failure that a compiler cannot see.

Lint is expected to report **zero** errors, not "fewer than before". A gate that always
prints a few warnings is a gate nobody reads.

Two checks live outside `verify` because they need real credentials and network access:

```bash
node scripts/retention-live-test.mjs   # proves stored files are really deleted
node scripts/humanize-check.mjs <file> # content check before publishing a post
```

---

## How to contribute

### Reporting a bug

1. Check [existing issues](https://github.com/devvaham/PDFly/issues) first
2. Include steps to reproduce, expected versus actual behaviour, and browser/OS
3. If it involves a PDF, say what produced it — output varies wildly by generator

### Suggesting a feature

Describe the use case, not just the solution. The most useful issues explain what someone
was trying to do and where the product got in the way.

### Submitting code

```bash
git checkout -b feature/your-feature-name
# ... make changes ...
npm run verify
git commit -m "feat: add PDF merge functionality"
```

Then push and open a pull request against `main`.

Commit messages follow the usual prefixes: `feat:`, `fix:`, `docs:`, `refactor:`,
`test:`, `chore:`.

---

## Code style

- **TypeScript everywhere.** Avoid `any`. When an external type is genuinely wrong,
  narrow to the real shape or to the function's own parameter type rather than widening to
  `any` — a wrong field should still fail.
- **Functional React components** with hooks. No class components.
- **Tailwind design tokens** from `index.css`. Never hardcode a colour.
- **Naming:** PascalCase components, camelCase functions and variables.
- **Prefer deleting to adding.** The smallest change that actually fixes the problem is
  the right one. An abstraction with one implementation is not worth its indirection.
- **Fix the root, not the symptom.** If four call sites need the same guard, the guard
  belongs in the thing they all call. `api/_lib/pdfInput.ts` exists because the SSRF
  check was previously pasted into five handlers, which is exactly how one of them ends
  up not getting the next security fix.

### Comments

Comments here explain **why**, not what. A comment that restates the code is noise; a
comment recording the bug that forced an odd-looking decision is what stops someone
"cleaning it up" and reintroducing the bug. If you work around something surprising,
write down what surprised you.

---

## Project structure

See [the README](README.md#project-structure) for the full tree. The parts worth knowing
before your first change:

| Path | Why it matters |
|------|----------------|
| `api/*.ts` | Each file is **one** Vercel Function, and Hobby allows twelve. Add operations to a namespace's route table, not a new file. |
| `api/_lib/` | Shared code. The leading underscore is what stops Vercel treating it as an entry point. |
| `api/_lib/tiers.ts` | Every per-tier limit, in one table. If you quote a limit in the UI, import it from here. |
| `src/lib/routeMeta.ts` | Per-route metadata and the sitemap source. |
| `src/lib/apiSpec.ts` | The public API documentation source. |
| `src/components/ui/` | Generated by the shadcn CLI. Excluded from lint because it gets regenerated. |
| `_internal/` | Planning and decision records. **Never published.** |

### Adding a page

Two files, both required, or the page will not be indexable:

1. `src/lib/routeMeta.ts` — title, description, sitemap priority
2. `src/App.tsx` — the route itself

`sitemap.xml` is generated, never hand-edited. It does not exist in the repo, only in
`dist/` after a build. Verify with `npm run build && npx serve dist` — not
`vite preview`, which SPA-rewrites every path and hides prerender bugs.

### Changing the API

If you add or change an endpoint:

1. Update `src/lib/apiSpec.ts`, which is what the public docs page renders
2. Add the route to `ROUTE_MATRIX` in `scripts/smoke-api.mjs` so it is actually exercised
3. **Call it for real and paste what came back.** Hand-written docs in this project have
   drifted from the implementation more than once. Describe what happened, not what you
   intended.

---

## Pull request guidelines

- One feature or fix per PR
- Update documentation when the change is user-facing
- Explain *what* and *why* in the description; the diff already shows *how*
- No console errors in the browser dev tools
- No new dependency for something a few lines can do

---

## Security

If you find a security vulnerability, **do not open a public issue**. See
[SECURITY.md](SECURITY.md) for responsible disclosure.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).

---

**Questions?** Open a [Discussion](https://github.com/devvaham/PDFly/discussions).
