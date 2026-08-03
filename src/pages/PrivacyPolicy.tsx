import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card } from "@/components/ui/card";
import { Shield, Monitor, Server, Cloud } from "lucide-react";
import { Link } from "react-router-dom";
import { SITE_URL } from "@/lib/config";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title="Privacy Policy — PDFly by 3idhMind" description="How PDFly handles your data. Web UI runs 100% locally in your browser. REST API processes files temporarily with auto-delete." keywords="PDFly privacy, PDF generator privacy policy, 3idhMind privacy" canonical={`${SITE_URL}/privacy`} />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2 flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" /> Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: July 28, 2026</p>
        </div>

        {/* Three-lane privacy summary */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="p-5 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Web UI (default)</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Text-to-PDF, images-to-PDF, merge, split, compress and PDF-to-images run{" "}
              <strong className="text-foreground">100% locally in your browser</strong> by default.
              Your files never leave your device.
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
              Files are processed on our servers. Generated PDFs sit in a private bucket behind
              signed URLs and are{" "}
              <strong className="text-foreground">automatically deleted within 1 hour</strong>.
              Request metadata is logged for abuse prevention.
            </p>
          </Card>
        </div>


        <Card className="p-8 space-y-6 glass">
          <section>
            <h2 className="text-xl font-semibold font-display text-foreground mb-3">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Account data:</strong> email address, display name, and hashed password (via our auth provider).
              <br /><br />
              <strong className="text-foreground">Web UI usage:</strong> we do not collect or upload any files or content you process in the browser. The only data that reaches our servers is anonymous session metadata (page views, error reports) used to keep the app running.
              <br /><br />
              <strong className="text-foreground">Cloud fallback usage:</strong> when — and only when — you tick the per-job consent box, the selected file is sent to a dedicated endpoint, held in memory for the duration of the request, and returned to you. It is never written to storage or the database, and file contents are never logged. We keep a short-lived, in-memory count of requests per IP address for rate limiting; it is not persisted.
              <br /><br />
              <strong className="text-foreground">Crash &amp; failure reports:</strong> if the app fails while you are using it, we record the error message, the page it happened on, the technical stack trace, your IP address and browser user agent so the maintainers can fix it. File names and file contents are never included in these reports.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">REST API usage:</strong> request metadata (endpoint, timestamp, IP address, user ID, response status, processing time, bytes processed) is logged for security, abuse prevention, and quota enforcement. The PDF content itself is processed in memory and stored only as the generated output file for delivery.

            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>To provide and maintain PDFly's Web UI and REST API</li>
              <li>To authenticate your account and manage API keys</li>
              <li>To enforce rate limits and detect abuse</li>
              <li>To send password reset emails and account notifications</li>
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
              <strong className="text-foreground">REST API:</strong> generated PDFs are stored in a private, signed-URL bucket and automatically deleted within 1 hour of creation. Request logs are retained for up to 30 days for security analysis, then purged.
            </p>
          </section>


          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Data Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All traffic is served over HTTPS. API keys are SHA-256 hashed before storage — we never store raw keys. Row-Level Security (RLS) policies ensure users can only access their own data. Storage buckets are private with signed, time-limited URLs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Cookies & Local Storage</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use local storage to persist your authentication session and theme preference. We do not use third-party tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Third-Party Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We rely on cloud infrastructure providers for hosting, database, edge compute, and authentication. These providers process data only as directed by us and are bound by their own security commitments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Rights</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>Access and export your account data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Revoke or delete API keys at any time from <Link to="/settings" className="text-primary hover:underline">Settings</Link></li>
              <li>Update your display name and password</li>
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
