import { Link } from "react-router-dom";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, PenTool } from "lucide-react";

// The two numbers below are not a typo — SSC CGL 2026's own 132-page notification
// gives different signature dimensions in Section 9.6 and in the Annexure. We show
// both rather than picking one, because we can't verify which the portal actually
// enforces, and neither can most applicants until they hit upload.
const SscSignatureSize = () => {
  return (
    <PdfToolLayout
      slug="exam/ssc-signature-size"
      title="SSC Signature Size Requirements — 2026"
      metaTitle="SSC CGL Signature Size 2026 (10-20KB) — Free Resizer | PDFly"
      metaDescription="SSC CGL 2026 signature spec: 10-20KB JPEG. The notification gives two conflicting dimensions (6.0x2.0cm vs 4.0x2.0cm) — here's both, plus why CGL 2026 has no photo upload at all."
      tagline="SSC CGL 2026 signature upload: what the notification actually says, including the part it contradicts itself on."
      howToSteps={[
        "Check your own SSC CGL 2026 notification's Annexure — it's usually the page the upload form actually validates against, and it may say 4.0×2.0cm rather than the 6.0×2.0cm in Section 9.6.",
        "Open the signature resizer and set the target to 10-20KB.",
        "Upload your signature scan or photo — resizing runs in your browser, nothing is sent anywhere.",
        "Download and upload the result to the SSC portal.",
      ]}
      faqs={[
        {
          q: "What size does my SSC signature need to be?",
          a: "10-20KB, JPEG format — that part is consistent everywhere we checked. The physical dimensions are the confusing part: see below.",
        },
        {
          q: "Why does this page show two different signature dimensions?",
          a: "Because the SSC CGL 2026 notification does. Section 9.6 of the document states 6.0cm x 2.0cm. The Annexure states 4.0cm x 2.0cm. Both appear in the same official PDF. We're not guessing which is right — we're telling you both exist so you check your own notification's Annexure, which is typically the page the upload form actually validates against.",
        },
        {
          q: "Do I need to upload a photo for SSC CGL 2026?",
          a: "No. CGL 2026 has no photo upload step at all — your photo is captured live via webcam or the mobile app during the exam process itself, not uploaded as a file beforehand. If you've seen advice quoting a photo file size like 20-50KB or dimensions like 3.5x4.5cm for CGL 2026, that's incorrect for this cycle; it may be describing an older SSC exam or a different commission's process.",
        },
        {
          q: "What if my signature file doesn't match either dimension?",
          a: "Resize it to fit your notification's Annexure spec first, and keep it inside 10-20KB. If both dimensions given here look wrong for the exam you're applying to, check the specific notification PDF you downloaded — SSC recruitment cycles vary and this page covers CGL 2026 only.",
        },
      ]}
    >
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">SSC CGL 2026 has no photo upload.</p>
          <p className="text-muted-foreground mt-1">
            Your photo is captured live via webcam or the SSC mobile app during the exam
            process — it is not a file you upload during registration. Signature is the
            only image file the CGL 2026 form asks you to upload. Pages elsewhere quoting
            an SSC "photo size" for this cycle are describing something that doesn't apply here.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-display font-bold mb-4">Signature spec — per SSC CGL 2026 notification</h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-background border border-border">
            <p className="text-muted-foreground">File size</p>
            <p className="text-lg font-semibold mt-1">10–20 KB</p>
            <p className="text-xs text-muted-foreground mt-1">JPEG, consistent across sources</p>
          </div>
          <div className="p-4 rounded-xl bg-background border border-border">
            <p className="text-muted-foreground">Section 9.6 says</p>
            <p className="text-lg font-semibold mt-1">6.0 × 2.0 cm</p>
          </div>
          <div className="p-4 rounded-xl bg-background border border-border">
            <p className="text-muted-foreground">Annexure says</p>
            <p className="text-lg font-semibold mt-1">4.0 × 2.0 cm</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Source: the official SSC CGL 2026 notification PDF, Section 9.6 and Annexure. Both
          figures are stated in the same document. When in doubt, the Annexure page is the one
          upload forms are usually built against — check yours before submitting.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
        <PenTool className="w-8 h-8 text-primary mx-auto mb-3" />
        <h2 className="text-xl font-display font-bold">Resize your signature to 10–20KB</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
          Runs entirely in your browser — no upload. Set the KB target to what your
          notification's Annexure specifies and crop to match your dimension.
        </p>
        <Button size="lg" asChild className="mt-4">
          <Link to="/resize-signature-to-10kb">Open Signature Resizer →</Link>
        </Button>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" /> Why signature uploads get rejected
        </h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>File is over 20KB — most phone-scanned signatures land in the 100KB-1MB range straight off a camera.</li>
          <li>File is under 10KB — over-compressing to "be safe" can push quality low enough that the portal's own size floor rejects it.</li>
          <li>Wrong aspect ratio for whichever dimension your notification's Annexure actually enforces.</li>
          <li>Format isn't JPEG — PNG or HEIC signatures from a phone camera need converting first.</li>
        </ul>
      </div>
    </PdfToolLayout>
  );
};

export default SscSignatureSize;
