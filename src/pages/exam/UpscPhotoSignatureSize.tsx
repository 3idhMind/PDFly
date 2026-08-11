import { Link } from "react-router-dom";
import { PdfToolLayout } from "@/components/PdfToolLayout";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ImageIcon, PenTool, FileWarning } from "lucide-react";

const UpscPhotoSignatureSize = () => {
  return (
    <PdfToolLayout
      slug="exam/upsc-photo-signature-size"
      title="UPSC Photo & Signature Size Requirements"
      metaTitle="UPSC Photo & Signature Size (JPG, 20-200KB) — Free Resizer | PDFly"
      metaDescription="UPSC portal specs: photo 20-200KB, signature 20-100KB at 350-500px, certificates 50-300KB PDF. These are minimums too — files can be rejected for being too small, not just too large."
      tagline="UPSC's upload form rejects files outside a range on both ends — too big AND too small. Here's the exact numbers."
      howToSteps={[
        "Confirm which file you're preparing: photo (20-200KB, JPG), signature (20-100KB, 350-500px, JPG), or certificate (50-300KB, PDF).",
        "Use the matching PDFly tool to resize it to fit the range — never as small as possible, since UPSC rejects undersized files too.",
        "Rename the downloaded file to exactly photo.jpg or signature.jpg before uploading — the portal checks the filename, not just the content.",
        "Upload to the UPSC portal.",
      ]}
      faqs={[
        {
          q: "What size does my UPSC photo need to be?",
          a: "20KB to 200KB, JPG format, and the filename must literally be \"photo\" (e.g. photo.jpg) — the portal rejects any other filename, format, or size, including files smaller than 20KB.",
        },
        {
          q: "What size does my UPSC signature need to be?",
          a: "20KB to 100KB, JPG format, 350-500 pixels in dimension, filename must literally be \"signature\". Same rule: too small gets rejected just as fast as too large.",
        },
        {
          q: "Can UPSC reject a file for being too small?",
          a: "Yes — this is the part most guides skip. UPSC's ranges are a floor as well as a ceiling. A photo under 20KB or a signature under 20KB fails upload just like an oversized one does. If you've over-compressed a file to \"be safe,\" that can be exactly what trips the rejection.",
        },
        {
          q: "What size do UPSC certificates need to be?",
          a: "PDF format, 50KB to 300KB.",
        },
        {
          q: "My file is too small — can PDFly increase its size?",
          a: "Not yet. Our tools currently only compress files down, not pad them up to a minimum. If your photo or signature is under UPSC's floor, you'll need to re-export it at a higher quality or resolution from the original source rather than resizing the small file — we don't want to claim a capability we haven't built.",
        },
        {
          q: "Why does the filename matter?",
          a: "UPSC's portal validates the filename itself, not just the file's content — it must be exactly \"photo\" or \"signature\" (with the correct extension). After you download a resized file from our tool, rename it to photo.jpg or signature.jpg before uploading; the tool doesn't currently auto-name the download for you.",
        },
      ]}
    >
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">These ranges are a floor as well as a ceiling.</p>
          <p className="text-muted-foreground mt-1">
            UPSC rejects files that are too small, not only files that are too large. A photo
            compressed down to 8KB "to be extra safe" fails the same way a 500KB photo does.
          </p>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card">
          <ImageIcon className="w-5 h-5 text-primary mb-2" />
          <p className="font-semibold">Photo</p>
          <p className="text-sm text-muted-foreground mt-1">JPG · 20KB–200KB</p>
          <p className="text-xs text-muted-foreground mt-1">Filename must be exactly "photo"</p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-card">
          <PenTool className="w-5 h-5 text-primary mb-2" />
          <p className="font-semibold">Signature</p>
          <p className="text-sm text-muted-foreground mt-1">JPG · 20KB–100KB · 350–500px</p>
          <p className="text-xs text-muted-foreground mt-1">Filename must be exactly "signature"</p>
        </div>
        <div className="p-5 rounded-2xl border border-border bg-card">
          <FileWarning className="w-5 h-5 text-primary mb-2" />
          <p className="font-semibold">Certificates</p>
          <p className="text-sm text-muted-foreground mt-1">PDF · 50KB–300KB</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-display font-bold mb-3">Why UPSC uploads get rejected</h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
          <li>File is outside the KB range — on either end. Phone photos usually land well over 200KB; a signature scanned at high DPI often lands over 100KB too.</li>
          <li>Signature isn't 350-500px in dimension — even if the file size is within range, the portal checks pixel dimensions separately.</li>
          <li>Filename isn't exactly "photo" or "signature" — the portal checks the filename string itself, not just size and format.</li>
          <li>Format isn't JPG — PNG, HEIC (common on iPhone), or WebP need converting first.</li>
        </ul>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <ImageIcon className="w-7 h-7 text-primary mx-auto mb-2" />
          <h3 className="font-display font-bold">Photo too large?</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Compress to fit the 20-200KB range, runs in your browser.
          </p>
          <Button asChild className="mt-3">
            <Link to="/compress-image-to-20kb">Compress Photo →</Link>
          </Button>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <PenTool className="w-7 h-7 text-primary mx-auto mb-2" />
          <h3 className="font-display font-bold">Signature too large?</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Compress toward the 20-100KB range. Check the output is 350-500px — the
            tool targets file size, not that exact pixel window, so confirm dimensions yourself.
          </p>
          <Button asChild className="mt-3">
            <Link to="/resize-signature-to-10kb">Resize Signature →</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-background/60 p-4 text-xs text-muted-foreground">
        After downloading, rename the file to exactly <code className="px-1 rounded bg-muted">photo.jpg</code> or{" "}
        <code className="px-1 rounded bg-muted">signature.jpg</code> before uploading — UPSC's
        portal validates the filename, and neither tool auto-names the download for you yet.
      </div>
    </PdfToolLayout>
  );
};

export default UpscPhotoSignatureSize;
