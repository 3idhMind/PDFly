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

- **Never commit secrets** — API keys, tokens, passwords must stay in environment variables
- **Never hardcode URLs** — Use `SITE_URL` from `src/lib/config.ts`
- **Validate all inputs** — Both client-side and in edge functions
- **Use RLS policies** — All database tables must have Row Level Security enabled
- **Keep dependencies updated** — Run `npm audit` regularly

## Architecture Security

- **Client-side processing**: Image-to-PDF conversion happens entirely in the browser — no images are uploaded to any server
- **API key hashing**: API keys are stored as SHA-256 hashes; raw keys are never persisted
- **Edge functions**: All serverless functions validate inputs and enforce rate limits
- **CORS**: Edge functions use permissive CORS for API access but validate authentication

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
- Third-party service vulnerabilities (e.g., Supabase infrastructure)

---

Thank you for helping keep PDFly and its users safe! 🔒
