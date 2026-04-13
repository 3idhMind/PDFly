import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border/60 bg-card/50 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-10 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-accent">
                <FileText className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-semibold text-foreground">PDFly</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              Universal PDF generation platform. Convert text or images to beautiful PDFs via web or API.
            </p>
            <p className="text-xs text-muted-foreground">
              Created by{" "}
              <a href="https://3idhmind.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                3idhMind
              </a>
            </p>
          </div>

          <div>
            <h3 className="font-display font-semibold text-foreground mb-3 text-sm">Tools</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/app" className="text-muted-foreground hover:text-foreground transition-colors">PDF Generator</Link></li>
              <li><Link to="/images-to-pdf" className="text-muted-foreground hover:text-foreground transition-colors">Images to PDF</Link></li>
              <li><Link to="/text-to-pdf" className="text-muted-foreground hover:text-foreground transition-colors">Text to PDF — Features</Link></li>
              <li><Link to="/image-to-pdf" className="text-muted-foreground hover:text-foreground transition-colors">Image to PDF — Features</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold text-foreground mb-3 text-sm">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/docs" className="text-muted-foreground hover:text-foreground transition-colors">API Documentation</Link></li>
              <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link to="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
              <li><Link to="/status" className="text-muted-foreground hover:text-foreground transition-colors">System Status</Link></li>
              <li><Link to="/#feedback" className="text-muted-foreground hover:text-foreground transition-colors">Give Feedback</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold text-foreground mb-3 text-sm">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/60 mt-8 pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} PDFly by 3idhMind. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
