import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { SITE_URL } from "@/lib/config";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title="Privacy Policy — PDFly by 3idhMind" description="PDFly privacy policy. Learn how we handle your data, API keys, and generated documents." keywords="PDFly privacy, PDF generator privacy policy, 3idhMind privacy" canonical={`${SITE_URL}/privacy`} />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2 flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" /> Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: March 8, 2026</p>
        </div>

        <Card className="p-8 space-y-6 glass">
          <section>
            <h2 className="text-xl font-semibold font-display text-foreground mb-3">1. Information We Collect</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We collect information you provide directly, including your email address, display name, and any content you submit for PDF generation. We also collect usage data such as API request metadata, document counts, processing times, and byte sizes processed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>To provide and maintain the PDF generation service</li>
              <li>To authenticate your account and manage API keys</li>
              <li>To track usage statistics and enforce rate limits</li>
              <li>To send password reset emails and account notifications</li>
              <li>To improve and optimize our service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Data Storage & Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your data is stored securely using industry-standard encryption. API keys are hashed using SHA-256 before storage — we never store raw API keys. All data transmission occurs over HTTPS. We use Row-Level Security (RLS) policies to ensure users can only access their own data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Document Content</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Content submitted for PDF generation is processed in real-time and is not permanently stored on our servers. Generated PDFs are created client-side in your browser. We log document metadata (title, template, language, page size, byte size) for usage tracking purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Cookies & Local Storage</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use local storage to persist your authentication session and theme preference. We do not use third-party tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Third-Party Services</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use cloud infrastructure providers for hosting, database, and authentication services. These providers are contractually obligated to protect your data and process it only as directed by us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Rights</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>Access and export your data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Revoke or delete API keys at any time</li>
              <li>Update your display name and password</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Data Retention</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Account data is retained as long as your account is active. Usage logs are retained for analytics and billing purposes. You may request complete data deletion by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a prominent notice on our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Contact Us</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, please reach out to us through our platform.
            </p>
          </section>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
