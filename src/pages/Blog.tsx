import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Calendar, Clock, ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { SITE_URL } from "@/lib/config";
import { loadBlogPosts, sortByDate, postDate, type BlogPost } from "@/lib/blogData";
import { useEffect, useState } from "react";


const Blog = () => {
  /*
   * Posts come from /blog-index.json, written by scripts/postbuild.mjs from the
   * same list that produced the prerendered HTML and the sitemap. They used to
   * be a hardcoded array here, which silently stopped matching the moment the
   * build started reading Firestore.
   */
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBlogPosts().then((p) => {
      if (!cancelled) setPosts(sortByDate(p));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="PDFly Blog — PDF Generation Guides, Tutorials & Tips | 3idhMinds"
        description="Learn about PDF generation, REST APIs, non-Latin script rendering, batch processing, and more. Free tutorials and guides by 3idhMinds."
        keywords="PDF generation blog, HTML to PDF tutorial, PDF API guide, Hindi PDF, Arabic PDF, invoice PDF, certificate PDF, 3idhMinds blog"
        canonical={`${SITE_URL}/blog`}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "PDFly Blog",
          url: `${SITE_URL}/blog`,
          description: "Guides, tutorials, and tips for PDF generation by 3idhMinds.",
          blogPost: (posts ?? []).map(p => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE_URL}/blog/${p.slug}`,
            datePublished: postDate(p),
            keywords: p.tags.join(", "),
            author: { "@type": "Organization", name: "3idhMinds" },
          })),
        })}</script>
      </Helmet>
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-4xl flex-1">
        <motion.div className="mb-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold font-display text-foreground mb-3 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" /> PDFly Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            Guides, tutorials, and tips for PDF generation — by <Link to="/" className="text-primary hover:underline">3idhMinds</Link>
          </p>
        </motion.div>

        <div className="space-y-8">
          {(posts ?? []).map((post, i) => (
            <motion.div key={post.slug} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden glass hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
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
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {postDate(post)}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readMinutes} min</span>
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
