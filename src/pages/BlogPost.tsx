import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { loadBlogPosts, sortByDate, postDate, type BlogPost } from "@/lib/blogData";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/config";



const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
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

  const postMeta = posts && slug ? posts.find((p) => p.slug === slug) ?? null : null;
  const content = postMeta?.content ?? null;

  if (!postMeta || !content) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-3xl flex-1 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Post Not Found</h1>
          <Button asChild><Link to="/blog"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog</Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  // Get related posts (other posts)
  const related = (posts ?? []).filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={`${postMeta.title} | PDFly Blog by 3idhMinds`}
        description={postMeta.excerpt}
        keywords={postMeta.tags.join(", ") + ", PDF generation, PDFly, 3idhMinds"}
        canonical={`${SITE_URL}/blog/${slug}`}
        ogType="article"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: postMeta.title,
          description: postMeta.excerpt,
          datePublished: postDate(postMeta),
          dateModified: postDate(postMeta),
          keywords: postMeta.tags.join(", "),
          author: { "@type": "Organization", name: "3idhMinds", url: SITE_URL },
          publisher: { "@type": "Organization", name: "PDFly by 3idhMinds", url: SITE_URL },
          mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}` },
        })}</script>
      </Helmet>
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link to="/blog"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Blog</Link>
        </Button>
        <article>
          <div className="flex flex-wrap gap-2 mb-4">
            {postMeta.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
          <h1 className="text-3xl font-bold font-display text-foreground mb-4">{postMeta.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {postDate(postMeta)}</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {postMeta.readMinutes} min</span>
          </div>
          
          <Card className="p-8 glass">
            <div className="prose prose-sm max-w-none">
              {content.split("\n\n").map((p, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-4">{p}</p>
              ))}
            </div>
          </Card>
        </article>

        {/* Internal backlinks */}
        <div className="mt-8 p-6 bg-secondary/30 rounded-lg">
          <h3 className="text-sm font-semibold font-display text-foreground mb-3">Quick Links</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/app">Try PDF Generator</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/pricing">View Pricing</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/docs">API Documentation</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/#feedback">Give Feedback</Link></Button>
          </div>
        </div>

        {/* Related Posts */}
        <div className="mt-10">
          <h3 className="text-lg font-semibold font-display text-foreground mb-4">Related Articles</h3>
          <div className="grid gap-4">
            {related.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="group">
                <Card className="p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{post.title}</h4>
                    <p className="text-xs text-muted-foreground">{post.readMinutes} min read</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;
