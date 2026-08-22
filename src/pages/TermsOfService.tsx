import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card } from "@/components/ui/card";
import { Scale } from "lucide-react";
import { Link } from "react-router-dom";

const TermsOfService = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead keywords="PDFly terms, PDF generator terms of service, 3idhMinds terms" />
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2 flex items-center gap-2">
            <Scale className="w-7 h-7 text-primary" /> Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: August 18, 2026</p>
        </div>

        <Card className="p-8 space-y-6 glass">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Service Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              PDFly provides a web-based PDF toolkit — merge, split, compress, resize images, ID photo crop, rotate, delete/reorder pages, images-to-PDF, PDF-to-images, and text/HTML-to-PDF — plus a REST API for programmatic access. The web tools run entirely in your browser and need no account; the REST API is for developers who want programmatic access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Account Registration</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You must sign in to access API features; sign-in is currently via Google only. Your account (via "idhtools", the identity system shared across 3idhMinds products) works across every 3idhMinds product, not just PDFly. You are responsible for maintaining the confidentiality of your account and API keys.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Acceptable Use</h2>
            <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
              <li>Do not use the service to generate illegal, harmful, or malicious content</li>
              <li>Do not attempt to circumvent rate limits or abuse the API</li>
              <li>Do not share API keys or allow unauthorized access to your account</li>
              <li>Do not submit content that infringes on intellectual property rights</li>
              <li>Do not use the service for spam, phishing, or fraudulent purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. API Usage, Rate Limits & the Free Tier</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The free tier includes 100 generated documents per month and 60 requests per minute per API key. The PDF generation endpoint accepts up to 5 documents per request, with a maximum content size of 500,000 characters per document and a title limit of 200 characters. Exceeding either limit returns a clear error rather than a silent failure or a charge — there is currently no paid tier, and nothing is billed automatically. We reserve the right to adjust these limits to keep the service usable for everyone; if a paid tier is introduced in the future it will be announced and priced openly, not retroactively applied to usage that was free when you made it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Content Ownership</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You retain full ownership of all content you submit. We do not claim any intellectual property rights over your content. Generated PDFs are your property. We process content solely to provide the service and do not use your content for any other purpose. How long a generated file exists on our servers afterwards, immediately discarded, or kept for one hour behind an expiring link, depends on the endpoint and our current infrastructure; see "Document Retention" in the <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for the exact behaviour.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Service Availability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We strive to maintain high availability but do not guarantee uninterrupted service. We may perform maintenance, updates, or modifications that temporarily affect availability. We will make reasonable efforts to notify users of planned downtime.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The service is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Account Termination</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time. Upon termination, your data will be deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Changes to Terms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may modify these terms at any time. Continued use of the service after changes constitutes acceptance of the updated terms. We will notify users of material changes via email or platform notification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Contact</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For questions about these Terms of Service: <a href="mailto:support@3idhmind.in" className="text-primary hover:underline">support@3idhmind.in</a>.
            </p>
          </section>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
