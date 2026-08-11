import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card } from "@/components/ui/card";
import { Shield, Monitor, Server, Cloud, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { SITE_URL } from "@/lib/config";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title="Privacy Policy — PDFly by 3idhMinds" description="How PDFly handles your data. Web UI runs 100% locally in your browser. REST API processes files inline with no persistent storage." keywords="PDFly privacy, PDF generator privacy policy, 3idhMinds privacy" canonical={`${SITE_URL}/privacy`} />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2 flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" /> Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: August 10, 2026</p>
        </div>

        {/* Three-lane privacy summary */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="p-5 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Web UI (default)</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every web tool — merge, split, compress, resize, ID photo crop, rotate, delete/reorder
              pages, images-to-PDF, PDF-to-images and text-to-PDF — runs{" "}
              <strong className="text-foreground">100% locally in your browser</strong>. Your files
              never leave your device, no account needed.
            </p>
          </Card>
          <Card className="p-5 border-border">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-5 h-5 text-foreground" />
              <h2 className="font-semibold text-foreground">Cloud fallback (opt-in)</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If a job is too heavy for your device, you may{" "}
              <strong className="text-foreground">explicitly tick a consent box</strong> for that one
              job. The file is then processed in memory on our server and returned in the same
              response — never written to storage, never saved to the database, contents never
              logged. Max 40 MB per job.
            </p>
          </Card>
          <Card className="p-5 border-accent/30 bg-accent/5">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-5 h-5 text-accent" />
              <h2 className="font-semibold text-foreground">REST API (developers)</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Files sent to the REST API are processed in memory and{" "}
              <strong className="text-foreground">returned in the same response</strong> — there is
              no persistent file storage today. Request metadata is logged for abuse prevention and
              quota enforcement.
            </p>
          </Card>
        </div>

        <Card className="p-5 mb-6 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">One account, several 3idhMinds products</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            PDFly's account system ("idhtools") is a shared identity layer used across every
            3idhMinds product, not a PDFly-specific login. Signing in once gives you access to
            whatever 3idhMinds tool you use next — no separate signup. As a result, basic account
            data (your email, display name, sign-in method, and which 3idhMinds products you've
            used) is shared across 3idhMinds products rather than siloed per product. File contents
            are never part of this — the identity layer stores only account and usage metadata,
            described below.
          </p>
        </Card>


        <Card className="p-8 space-y-6 glass">
          <section>
            <h2 className="text-xl font-semibold font-display text-foreground mb-3">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Account data:</strong> we sign you in with Google (that's the only sign-in method currently offered — email/password support exists on the backend but its UI is switched off until password-recovery email is fully configured). When you sign in, we store your email address, display name, profile photo URL, sign-in method and timestamps, and which 3idhMinds products you've joined — see "One account, several 3idhMinds products" above.
              <br /><br />
              <strong className="text-foreground">Account activity log:</strong> we keep an append-only log of account-level events — sign-in, sign-out, API key creation and revocation — for your own security history. This log never contains file contents.
              <br /><br />
              <strong className="text-foreground">API usage counters:</strong> monthly usage counters per product (e.g. "37 PDFs generated this month") so we can enforce free-tier limits. These are counts only, never file contents.
              <br /><br />
              <strong className="text-foreground">Web UI usage:</strong> we do not collect or upload any files or content you process in the browser. The only data that reaches our servers is anonymous session metadata (page views, error reports) used to keep the app running.
              <br /><br />
              <strong className="text-foreground">Cloud fallback usage:</strong> when — and only when — you tick the per-job consent box, the selected file is sent to a dedicated endpoint, held in memory for the duration of the request, and returned to you. It is never written to storage or the database, and file contents are never logged. We keep a short-lived, in-memory count of requests per IP address for rate limiting; it is not persisted.
              <br /><br />
              <strong className="text-foreground">Crash &amp; failure reports:</strong> if the app fails while you are using it, we record the error message, the page it happened on, the technical stack trace, your IP address and browser user agent so the maintainers can fix it. File names and file contents are never included in these reports.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">REST API usage:</strong> request metadata (endpoint, timestamp, IP address, user ID, response status, processing time, bytes processed) is logged for security, abuse prevention, and quota enforcement. The file you send is processed in memory and returned in the same response; it is not stored.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>To provide and maintain PDFly's Web UI and REST API</li>
              <li>To authenticate your account and manage API keys</li>
              <li>To enforce rate limits and detect abuse</li>
              <li>To send account-related emails (e.g. sign-in confirmations, password reset if that sign-in method is enabled)</li>
              <li>To improve reliability and performance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Document Retention</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Web UI (local):</strong> nothing reaches our servers, so nothing is stored. Ever.
              <br /><br />
              <strong className="text-foreground">Cloud fallback (opt-in):</strong> zero retention. The file exists only in server memory for the length of the request and is discarded when the response is sent. No bucket write, no database row, no content logging.
              <br /><br />
              <strong className="text-foreground">REST API:</strong> files you send are processed in memory and returned in the same response; there is no persistent file storage today. Request logs are retained for up to 30 days for security analysis, then purged.
            </p>
          </section>


          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Data Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All traffic is served over HTTPS. API keys are SHA-256 hashed before storage — the raw key is shown once at creation and never again, and revoking a key is immediate and irreversible. Firestore Security Rules restrict every account document so a user can only read and write their own data; anything that grants access or affects a quota (API key records, usage counters) is writable only by our server, never directly by a client.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Cookies & Local Storage</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use local storage to persist your authentication session and theme preference. We use Google Tag Manager for basic web analytics (page views, general usage patterns) — see Third-Party Services below. We do not run ad-targeting cookies or trackers; we have not applied for ad services such as Google AdSense.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Third-Party Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We rely on cloud infrastructure providers for hosting, database, edge compute, and authentication — currently Firebase (Google) for sign-in and account data, and Vercel for hosting and the REST API. We use Google Tag Manager (basic web analytics, not ad targeting) to understand how the site is used. These providers process data only as directed by us and are bound by their own security commitments. We do not use a separate third-party email-sending service — account emails (e.g. password reset, when that sign-in method is enabled) are sent by Firebase's own auth email delivery.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Rights</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>Access and export your account data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Revoke or delete API keys at any time from <Link to="/settings" className="text-primary hover:underline">Settings</Link> — revocation is immediate and irreversible</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a prominent notice on our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Questions about this policy? Reach us through the platform.
            </p>
          </section>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
