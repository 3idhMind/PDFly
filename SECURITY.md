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

1. **Email**: Send details to **support@3idhmind.in**
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
- **Never hardcode URLs or limits.** Use `SITE_URL` from `src/lib/config.ts` for anything
  SEO-facing, and `api/_lib/tiers.ts` for any size or quota figure you show a user. Both
  exist so a value cannot be right in one place and stale in another.
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
  URL inputs against SSRF (including DNS-rebinding checks). The SSRF guard lives in one
  shared module, `api/_lib/pdfInput.ts`, rather than being pasted into each handler —
  duplicated guards are how one endpoint quietly misses the next fix.
- **Download links**: HMAC-signed with an embedded expiry, verified with no database read.
  Storage keys begin with the owner's uid, so an unsigned key would suggest the shape of
  everyone else's. Invalid, tampered and expired tokens all answer 404 so probing cannot
  distinguish them.
- **Retention**: files generated through the API are deleted once their TTL passes — the
  object itself, not merely the link. Verified end to end against the live backend by
  `scripts/retention-live-test.mjs`.
- **Error logging**: errors are logged by name only — never request bodies, file contents,
  or key material.

### Known gaps, stated honestly

- **No independent security review has been done.** The endpoints under `api/` were
  ported from an earlier Deno implementation, and while individual areas have been fixed
  as problems were found (SSRF, magic-byte validation, key hashing, token signing), no
  adversarial pass over the whole surface has happened. The browser tools remain the
  surface with the smallest attack area, because they involve no server at all.
- **Rate limiting is per-instance, not global.** It lives in process memory, so a caller
  spread across several warm serverless instances can exceed the per-minute limit by
  roughly that factor. This is a deliberate trade: the alternative costs a database read
  and write on every request. The monthly quota *is* authoritative and shared. See the
  note in `api/_lib/quota.ts`.
- **The anonymous upload path is bounded by IP.** An IP is a weak identity — carriers NAT
  many users behind one, and addresses rotate. It is a speed bump against casual scripted
  abuse, not an access control. No account data is reachable without a credential.
- **Storage credentials are account-wide.** The Filen adapter authenticates with an
  account email and password, which grants the whole account rather than one scoped
  bucket. A dedicated account is used for this and nothing else. The S3 adapter, which
  supports properly scoped keys, is implemented and can be switched to by setting the
  `STORAGE_*` variables instead.

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
