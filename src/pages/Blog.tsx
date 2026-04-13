import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Calendar, Clock, ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { SITE_URL } from "@/lib/config";

export interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  tags: string[];
  image?: string;
}

export const blogPosts: BlogPostMeta[] = [
  {
    slug: "convert-images-to-pdf-free",
    title: "Convert Images to PDF Free — JPG, PNG, HEIC & 25+ Formats",
    excerpt: "Learn how to convert any image to PDF using PDFly. Supports 100+ images, 25+ formats including HEIC, WebP, RAW. Free, fast, client-side processing.",
    date: "2026-03-28", readTime: "8 min",
    tags: ["Image to PDF", "Free", "Tutorial"],
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop",
  },
  {
    slug: "top-10-free-pdf-tools-developers-2026",
    title: "Top 10 Free PDF Tools Every Developer Needs in 2026",
    excerpt: "A curated list of the best free PDF tools for developers — generators, converters, APIs, and utilities that save hours of work.",
    date: "2026-03-25", readTime: "10 min",
    tags: ["Tools", "Listicle", "2026"],
    image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&h=400&fit=crop",
  },
  {
    slug: "pdf-generation-pipeline-pdfly-api",
    title: "How to Build a PDF Generation Pipeline with PDFly API",
    excerpt: "Step-by-step technical tutorial on building an automated PDF pipeline — from data collection to generation to delivery. JavaScript, Python examples.",
    date: "2026-03-22", readTime: "14 min",
    tags: ["Pipeline", "Automation", "Tutorial"],
    image: "https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=800&h=400&fit=crop",
  },
  {
    slug: "pdfly-vs-adobe-smallpdf-comparison",
    title: "PDFly vs Adobe Acrobat vs SmallPDF — Free PDF Converter Comparison",
    excerpt: "Honest comparison of PDFly, Adobe Acrobat, and SmallPDF. Features, pricing, API access, language support, and developer experience compared.",
    date: "2026-03-19", readTime: "11 min",
    tags: ["Comparison", "Adobe", "SmallPDF"],
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop",
  },
  {
    slug: "html-to-pdf-api-guide",
    title: "How to Convert HTML to PDF with a REST API — Complete Guide 2026",
    excerpt: "Learn how to generate professional PDFs from HTML content using PDFly's free REST API. Includes code examples in JavaScript, Python, PHP, and Go.",
    date: "2026-03-08", readTime: "12 min",
    tags: ["API", "Tutorial", "HTML to PDF"],
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=400&fit=crop",
  },
  {
    slug: "multi-language-pdf-generation",
    title: "Generating PDFs in Hindi, Arabic & 70+ Languages — No Font Hassle",
    excerpt: "Most PDF generators break with non-Latin scripts. PDFly natively supports 70+ languages including Hindi, Arabic, Chinese, Japanese, Korean, and Hinglish.",
    date: "2026-03-07", readTime: "10 min",
    tags: ["Multi-language", "Hindi", "Arabic", "RTL"],
    image: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&h=400&fit=crop",
  },
  {
    slug: "batch-pdf-generation-api",
    title: "Batch PDF Generation: Create 5 Documents in One API Call",
    excerpt: "Learn how to generate multiple PDFs simultaneously using PDFly's batch API. Perfect for invoices, certificates, reports.",
    date: "2026-03-06", readTime: "8 min",
    tags: ["API", "Batch", "Performance"],
    image: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=400&fit=crop",
  },
  {
    slug: "pdf-templates-guide",
    title: "15 PDF Templates: From Minimal to Corporate — Choose Your Style",
    excerpt: "PDFly offers 15 professionally designed templates. Here's a detailed guide to each one and when to use them.",
    date: "2026-03-05", readTime: "9 min",
    tags: ["Templates", "Design", "Guide"],
    image: "https://images.unsplash.com/photo-1542621334-a254cf47733d?w=800&h=400&fit=crop",
  },
  {
    slug: "free-pdf-api-developers",
    title: "Free PDF Generation API for Developers — No Credit Card Required",
    excerpt: "PDFly offers a completely free REST API for PDF generation. Get API keys, generate PDFs programmatically, build document workflows at zero cost.",
    date: "2026-03-04", readTime: "7 min",
    tags: ["Free", "API", "Developers"],
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop",
  },
  {
    slug: "invoice-pdf-generation-tutorial",
    title: "How to Generate Invoices as PDFs Automatically — Complete Tutorial",
    excerpt: "Automate invoice generation with PDFly. Create professional invoices in any language, with custom templates and batch processing for billing systems.",
    date: "2026-03-03", readTime: "11 min",
    tags: ["Invoice", "Automation", "Tutorial"],
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=400&fit=crop",
  },
  {
    slug: "pdf-api-vs-puppeteer-wkhtmltopdf",
    title: "PDFly API vs Puppeteer vs wkhtmltopdf — Which PDF Solution is Best?",
    excerpt: "A comprehensive comparison of popular PDF generation methods. When to use each, pros and cons, performance benchmarks, and cost analysis.",
    date: "2026-03-02", readTime: "13 min",
    tags: ["Comparison", "Puppeteer", "wkhtmltopdf"],
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop",
  },
  {
    slug: "pdf-generation-for-saas",
    title: "Adding PDF Export to Your SaaS App — A Developer's Complete Guide",
    excerpt: "Step-by-step guide to integrating PDF export functionality into your SaaS application using PDFly's REST API. React, Vue, and Node.js examples included.",
    date: "2026-03-01", readTime: "14 min",
    tags: ["SaaS", "Integration", "Guide"],
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop",
  },
  {
    slug: "rtl-pdf-generation-arabic-hebrew",
    title: "Right-to-Left PDF Generation: Arabic, Hebrew, Urdu & Persian Support",
    excerpt: "How PDFly handles RTL languages perfectly. Automatic text direction, proper font selection, and mixed-direction content in a single PDF.",
    date: "2026-02-28", readTime: "8 min",
    tags: ["RTL", "Arabic", "Hebrew", "Urdu"],
    image: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&h=400&fit=crop",
  },
  {
    slug: "certificate-pdf-generation-bulk",
    title: "Generate Bulk Certificates as PDFs — Event, Course & Award Certificates",
    excerpt: "Create hundreds of personalized certificates in minutes. Perfect for online courses, events, workshops. Use templates or design custom layouts.",
    date: "2026-02-27", readTime: "9 min",
    tags: ["Certificates", "Bulk", "Education"],
    image: "https://images.unsplash.com/photo-1523050854058-8df90110c476?w=800&h=400&fit=crop",
  },
];
const Blog = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="PDFly Blog — PDF Generation Guides, Tutorials & Tips | 3idhMind"
        description="Learn about PDF generation, REST APIs, multi-language support, batch processing, and more. Free tutorials and guides by 3idhMind."
        keywords="PDF generation blog, HTML to PDF tutorial, PDF API guide, multi-language PDF, invoice PDF, certificate PDF, 3idhMind blog"
        canonical={`${SITE_URL}/blog`}
      />
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-4xl flex-1">
        <motion.div className="mb-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold font-display text-foreground mb-3 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" /> PDFly Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            Guides, tutorials, and tips for PDF generation — by <Link to="/" className="text-primary hover:underline">3idhMind</Link>
          </p>
        </motion.div>

        <div className="space-y-8">
          {blogPosts.map((post, i) => (
            <motion.div key={post.slug} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden glass hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
                {post.image && (
                  <Link to={`/blog/${post.slug}`}>
                    <img src={post.image} alt={post.title} className="w-full h-48 object-cover" loading="lazy" />
                  </Link>
                )}
                <div className="p-6">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  <h2 className="text-xl font-bold font-display text-foreground mb-2 hover:text-primary transition-colors">
                    <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{post.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {post.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime}</span>
                    </div>
                    <Link to={`/blog/${post.slug}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                      Read more <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Backlinks */}
        <div className="mt-12 pt-8 border-t border-border">
          <h3 className="text-sm font-semibold font-display text-foreground mb-4">Explore PDFly</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild><Link to="/app">PDF Generator</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/images-to-pdf">Images to PDF</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/text-to-pdf">Text to PDF</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/image-to-pdf">Image to PDF</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/pricing">Pricing</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/docs">API Docs</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/status">System Status</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/#feedback">Give Feedback</Link></Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
