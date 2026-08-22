import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card } from "@/components/ui/card";
import { Shield, Monitor, Server, Cloud, Users } from "lucide-react";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead keywords="PDFly privacy, PDF generator privacy policy, 3idhMinds privacy" />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2 flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" /> Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: August 18, 2026</p>
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
              Files sent to the REST API's document-generation endpoints (merge, split, compress,
              convert, generate) are always{" "}
              <strong className="text-foreground">returned in the same response</strong>. When our
              object-storage backend is configured, the same file is <strong className="text-foreground">
              also kept for one hour</strong> behind a private, expiring download link on our own
              domain, then permanently deleted — the response tells you which of the two happened.
              When storage is not configured, nothing is retained at all. Either way, request
              metadata is logged for abuse prevention and quota enforcement.
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
              <strong className="text-foreground">REST API usage:</strong> request metadata (endpoint, timestamp, IP address, user ID, response status, processing time, bytes processed) is logged for security, abuse prevention, and quota enforcement. What happens to the file you send is covered in "Document Retention" below — it depends on whether object storage is configured for that endpoint.
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
              <strong className="text-foreground">REST API — anonymous fallback endpoint:</strong> zero retention, identical to the cloud fallback above. No storage write, no database row, no logging of contents.
              <br /><br />
              <strong className="text-foreground">REST API — authenticated document endpoints:</strong> the generated file is always returned directly in the response. Whether a copy is <em>also</em> kept afterwards depends on whether object storage is configured on our infrastructure at the time:
              <br /><br />
              <span className="text-foreground">If storage is configured</span> — the file is additionally written to our storage provider under a key scoped to your account, and a signed, time-limited download link on our own domain (never the storage provider's domain) is included in the response. That link and the underlying file both stop working <strong className="text-foreground">one hour</strong> after generation, at which point the file is permanently deleted. This is checked and enforced automatically: every new file upload triggers a cleanup pass that deletes anything past its one-hour mark, and a daily scheduled job catches anything a quiet period would otherwise leave behind.
              <br /><br />
              <span className="text-foreground">If storage is not configured</span> — nothing is written anywhere. The file exists only inside that one HTTP response; once it is received, we hold no copy at all.
              <br /><br />
              The API response always states plainly which of the two applies to that specific file, so you never have to guess whether you need to save it immediately.
              <br /><br />
              Request logs (metadata only, never file contents) are retained for up to 30 days for security analysis, then purged.
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
              We rely on cloud infrastructure providers for hosting, database, edge compute, and authentication — currently Firebase (Google) for sign-in and account data, and Vercel for hosting and the REST API. When the one-hour file backup described in "Document Retention" is active, a separate cloud storage provider holds that copy for the hour it exists; we deliberately don't name it here or anywhere in the product, on the same reasoning as not naming our other infrastructure in public status pages — it changes nothing about your privacy exposure and only helps someone looking for a specific vendor's misconfigurations to try. We use Google Tag Manager (basic web analytics, not ad targeting) to understand how the site is used. These providers process data only as directed by us and are bound by their own security commitments. We do not use a separate third-party email-sending service — account emails (e.g. password reset, when that sign-in method is enabled) are sent by Firebase's own auth email delivery.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Who Can See What You Send Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              File contents you process are never manually reviewed by anyone — the pipeline is
              fully automated, and the retention rules above are the whole story for how long a file
              exists after you send it.
              <br /><br />
              One designated administrator account has access to two things beyond their own data:
              messages submitted through our feedback form, and an internal error/activity log used
              to diagnose problems (which endpoint failed, when, for which account — never file
              contents). This access is enforced server-side against a single verified email
              address; it cannot be granted to any other account, and an ordinary signed-in user or
              API key has no path to it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Your Rights</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>Access and export your account data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Revoke or delete API keys at any time from <Link to="/settings" className="text-primary hover:underline">Settings</Link> — revocation is immediate and irreversible</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a prominent notice on our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Questions about this policy, or a data deletion request: <a href="mailto:support@3idhmind.in" className="text-primary hover:underline">support@3idhmind.in</a>.
            </p>
          </section>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
