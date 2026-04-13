import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, FileText } from "lucide-react";
import { formatBytes } from "@/lib/pdfGenerator";

interface PDFPreviewProps {
  pdfs: Array<{ title: string; url: string; sizeBytes: number }>;
}

export const PDFPreview = ({ pdfs }: PDFPreviewProps) => {
  const handleDownload = (pdf: { title: string; url: string }) => {
    const a = document.createElement('a');
    a.href = pdf.url;
    a.download = `${pdf.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_')}.pdf`;
    a.click();
  };

  const handlePrint = (pdf: { url: string }) => {
    const win = window.open(pdf.url, '_blank');
    if (win) {
      win.addEventListener('load', () => win.print());
    }
  };

  const handleDownloadAll = () => {
    pdfs.forEach((pdf) => handleDownload(pdf));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Generated PDFs ({pdfs.length})
        </h2>
        {pdfs.length > 1 && (
          <Button onClick={handleDownloadAll} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" />
            Download All
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pdfs.map((pdf, i) => (
          <Card key={i} className="p-5 bg-card shadow-md">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground truncate">{pdf.title}.pdf</h3>
                <p className="text-xs text-muted-foreground">{formatBytes(pdf.sizeBytes)}</p>
              </div>
            </div>

            <div className="bg-muted rounded-lg h-40 mb-4 flex items-center justify-center">
              <iframe src={pdf.url} className="w-full h-full rounded-lg" title={pdf.title} />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleDownload(pdf)} size="sm" className="flex-1">
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
              <Button onClick={() => handlePrint(pdf)} variant="outline" size="sm" className="flex-1">
                <Printer className="w-4 h-4 mr-1" />
                Print
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
