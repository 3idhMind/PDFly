import html2pdf from 'html2pdf.js';
import { PDFTemplate, DocumentSection, pageSizes } from '@/types/pdf';

interface GenerateOptions {
  documents: DocumentSection[];
  template: PDFTemplate;
  pageSize: string;
  language: string;
  onProgress?: (current: number, total: number, stage: string) => void;
}

interface GeneratedPDF {
  title: string;
  blob: Blob;
  url: string;
  sizeBytes: number;
}

const PAGE_SIZES: Record<string, [number, number]> = Object.fromEntries(
  pageSizes.map((s) => [s.id, [s.width, s.height] as [number, number]])
);

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

function buildStyledHtml(doc: DocumentSection, template: PDFTemplate, language: string): string {
  const isRtl = RTL_LANGUAGES.includes(language);
  const content = doc.content.includes('<') ? doc.content : `<p>${doc.content.replace(/\n/g, '</p><p>')}</p>`;

  return `
    <div style="
      font-family: '${template.fonts.body}', 'Noto Sans', sans-serif;
      color: ${template.colors.text};
      background: ${template.colors.background};
      padding: 40px;
      direction: ${isRtl ? 'rtl' : 'ltr'};
      line-height: 1.6;
    ">
      <div style="
        border-bottom: 3px solid ${template.colors.primary};
        padding-bottom: 16px;
        margin-bottom: 24px;
      ">
        <h1 style="
          font-family: '${template.fonts.heading}', sans-serif;
          color: ${template.colors.primary};
          font-size: 28px;
          margin: 0 0 4px 0;
          font-weight: 700;
        ">${doc.title}</h1>
        <div style="
          font-size: 11px;
          color: ${template.colors.secondary};
        ">Generated on ${new Date().toLocaleDateString()} • Template: ${template.name}</div>
      </div>
      <div style="font-size: 14px;">
        ${content}
      </div>
    </div>
  `;
}

export async function generatePDFs(options: GenerateOptions): Promise<GeneratedPDF[]> {
  const { documents, template, pageSize, language, onProgress } = options;
  const results: GeneratedPDF[] = [];
  const total = documents.length;
  const [width, height] = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    onProgress?.(i, total, `Generating "${doc.title}"...`);

    const styledHtml = buildStyledHtml(doc, template, language);

    const container = document.createElement('div');
    container.innerHTML = styledHtml;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = `${width}mm`;
    document.body.appendChild(container);

    try {
      const blob: Blob = await html2pdf()
        .set({
          margin: 0,
          filename: `${doc.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: [width, height], orientation: width > height ? 'landscape' : 'portrait' },
        })
        .from(container)
        .outputPdf('blob');

      const url = URL.createObjectURL(blob);
      results.push({
        title: doc.title,
        blob,
        url,
        sizeBytes: blob.size,
      });
    } finally {
      document.body.removeChild(container);
    }
  }

  onProgress?.(total, total, 'Complete!');
  return results;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
