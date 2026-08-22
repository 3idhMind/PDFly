import { Link } from "react-router-dom";
import { Github, Mail } from "lucide-react";
import { TOOLS } from "@/lib/toolsList";
import { ApiStatusBadge } from "@/components/ApiStatusBadge";

export const Footer = () => {
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="container mx-auto px-5 py-8 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="max-w-xs">
            <div className="flex flex-col leading-none mb-2">
              <span className="font-display font-bold text-lg text-foreground">PDFly</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">by 3idhMinds</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The only free PDF toolkit where your files never leave your browser.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-10 gap-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-2.5 text-[11px] uppercase tracking-wider">Tools</h3>
              {/*
                Every tool, not a slice of four. The footer is a real internal
                linking surface: it is the one block present on all 46 pages, so
                truncating it withheld link equity from two thirds of the tools
                and left them reachable only through the nav dropdown.
              */}
              <ul className="space-y-1.5 text-sm">
                {TOOLS.map((t) => (
                  <li key={t.href}>
                    <Link to={t.href} className="text-muted-foreground hover:text-foreground transition-colors">{t.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2.5 text-[11px] uppercase tracking-wider">Guides</h3>
              <ul className="space-y-1.5 text-sm">
                <li><Link to="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link to="/exam/ssc-signature-size" className="text-muted-foreground hover:text-foreground transition-colors">SSC signature size</Link></li>
                <li><Link to="/exam/upsc-photo-signature-size" className="text-muted-foreground hover:text-foreground transition-colors">UPSC photo &amp; signature</Link></li>
                <li><Link to="/id-photo-crop" className="text-muted-foreground hover:text-foreground transition-colors">Aadhaar / PAN photo crop</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2.5 text-[11px] uppercase tracking-wider">Developers</h3>
              <ul className="space-y-1.5 text-sm">
                <li><Link to="/docs" className="text-muted-foreground hover:text-foreground transition-colors">API documentation</Link></li>
                <li><Link to="/api-playground" className="text-muted-foreground hover:text-foreground transition-colors">API playground</Link></li>
                <li><Link to="/status" className="text-muted-foreground hover:text-foreground transition-colors">System status</Link></li>
                <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2.5 text-[11px] uppercase tracking-wider">Company</h3>
              <ul className="space-y-1.5 text-sm">
                <li><Link to="/create" className="text-muted-foreground hover:text-foreground transition-colors">All tools</Link></li>
                <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy policy</Link></li>
                <li><Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of service</Link></li>
                <li>
                  <a href="https://github.com/devvaham/PDFly" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <Github className="w-3.5 h-3.5" /> GitHub
                  </a>
                </li>
                <li>
                  <a href="mailto:support@3idhmind.in" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="w-3.5 h-3.5" /> support@3idhmind.in
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-8 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()} PDFly by 3idhMinds. All rights reserved.
          </p>
          {/* Real probe, on every page. See components/ApiStatusBadge.tsx. */}
          <ApiStatusBadge className="self-start sm:self-auto" />
        </div>
      </div>
    </footer>
  );
};
