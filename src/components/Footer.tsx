import { Link } from "react-router-dom";
import { Github } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="mt-auto border-t-2 border-primary/60 bg-background">
      <div className="container mx-auto px-5 py-12 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="flex flex-col leading-none mb-3">
              <span className="font-display font-bold text-xl text-foreground">PDFly</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">by 3idhMinds</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              The only free PDF API where your files never leave your browser.
            </p>
          </div>

          <div>
            <h3 className="font-display font-semibold text-foreground mb-3 text-sm">Product</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/app" className="text-muted-foreground hover:text-foreground transition-colors">Text to PDF</Link></li>
              <li><Link to="/images-to-pdf" className="text-muted-foreground hover:text-foreground transition-colors">Images to PDF</Link></li>
              <li><Link to="/docs" className="text-muted-foreground hover:text-foreground transition-colors">API Documentation</Link></li>
              <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold text-foreground mb-3 text-sm">Legal & Source</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li>
                <a href="https://github.com/3idhMind" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <Github className="w-3.5 h-3.5" /> GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} PDFly by 3idhMinds. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built in Public by Dev Vaham ·{" "}
            <a href="https://instagram.com/devvaham" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary transition-colors">
              @devvaham on Instagram
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
