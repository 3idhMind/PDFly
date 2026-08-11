# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| Latest  | ✅ Yes             |
| Older   | ❌ No              |

We only provide security fixes for the latest version on the `main` branch.

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in PDFly, please report it responsibly:

1. **Email**: Send details to **security@3idhmind.in**
2. **Subject line**: `[SECURITY] PDFly — Brief description`
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours of your report
- **Assessment**: We will evaluate the severity within 5 business days
- **Fix timeline**: Critical vulnerabilities will be patched within 7 days; others within 30 days
- **Credit**: You will be credited in the release notes (unless you prefer anonymity)

## Security Best Practices for Contributors

- **Never commit secrets.** `.env` is gitignored. `.env.example` is the tracked template.
- **Know which env vars are public.** Anything `VITE_`-prefixed is compiled into the browser
  bundle and readable by any visitor — that is correct for Firebase *web* config. The
  service-account credentials (`FIREBASE_PRIVATE_KEY` and friends) are server-only and must
  never gain a `VITE_` prefix.
- **Never hardcode URLs** — use `SITE_URL` from `src/lib/config.ts`, or `SITE_ORIGIN` from
  `src/lib/routeMeta.ts` for anything SEO-facing.
- **Validate all inputs** — both client-side and in the `api/` functions.
- **Firestore rules are the access control.** Any new collection needs a matching rule in
  `firestore.rules`; a collection with no rule is not "default private" in a useful sense —
  write the rule.
- **Keep dependencies updated** — run `npm audit` regularly.

## Architecture Security

- **Client-side processing**: the web tools (merge, split, compress, image/PDF conversion,
  resize, crop) run entirely in the browser. Files are never uploaded. Server processing via
  the REST API is opt-in and separate.
- **Authentication**: Firebase Authentication, Google sign-in. The account is shared across
  3idhMinds products — see the Privacy Policy.
- **API key hashing**: keys are stored as SHA-256 hashes. The raw key is shown once at
  creation and never persisted; only a short display prefix is kept.
- **Serverless functions**: the Vercel Functions under `api/` authenticate the caller, apply
  per-key rate limits and monthly quotas, validate magic bytes on uploaded files, and guard
  URL inputs against SSRF (including DNS-rebinding checks).
- **Error logging**: errors are logged by name only — never request bodies, file contents,
  or key material.

### Known gaps, stated honestly

- The REST API endpoints under `api/` were ported from the previous Deno/Supabase
  implementation and their adversarial review pass has **not** completed. Treat the API as
  pre-release; the browser tools are the supported surface.
- API responses currently return PDFs inline as base64 rather than via expiring signed
  storage URLs. Object storage is planned and tracked in-code as `TODO(stage-3)`.

## Scope

The following are in scope for security reports:

- Authentication/authorization bypasses
- Data exposure or leakage
- Cross-site scripting (XSS)
- SQL injection
- Insecure API endpoints
- Secrets exposed in source code or Git history

The following are **out of scope**:

- Denial of service (DoS/DDoS)
- Social engineering
- Physical attacks
- Third-party service vulnerabilities (e.g. Firebase or Vercel infrastructure)
- Values in the client bundle that are public by design (`VITE_FIREBASE_*` web config) —
  these are not secrets; report a missing **Firestore rule** instead, which is in scope

---

Thank you for helping keep PDFly and its users safe! 🔒
