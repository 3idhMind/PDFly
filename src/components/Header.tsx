import { FileText, Settings, BookOpen, LogIn, LogOut, TrendingUp, Menu, X, DollarSign, Activity, Newspaper, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";

export const Header = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const closeMenu = () => setMobileOpen(false);

  const navLinkClass = "relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 px-3 py-2 rounded-md hover:bg-secondary/80 group";

  return (
    <header className="border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-7xl">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent shadow-md group-hover:shadow-lg transition-shadow duration-300">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display text-foreground tracking-tight">PDFly</h1>
            <p className="text-[10px] text-muted-foreground leading-none">by 3idhMind</p>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link to="/app" className={navLinkClass}>
            <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Generator</span>
          </Link>
          <Link to="/images-to-pdf" className={navLinkClass}>
            <span className="flex items-center gap-1.5"><ImagePlus className="w-3.5 h-3.5" /> Images to PDF</span>
          </Link>
          <Link to="/pricing" className={navLinkClass}>
            <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Pricing</span>
          </Link>
          <Link to="/docs" className={navLinkClass}>
            <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> API Docs</span>
          </Link>
          <Link to="/blog" className={navLinkClass}>
            <span className="flex items-center gap-1.5"><Newspaper className="w-3.5 h-3.5" /> Blog</span>
          </Link>
          {user && (
            <>
              <Link to="/analytics" className={navLinkClass}>
                <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Analytics</span>
              </Link>
              <Link to="/settings" className={navLinkClass}>
                <span className="flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> Settings</span>
              </Link>
            </>
          )}
          <div className="w-px h-6 bg-border mx-1" />
          {user ? (
            <Button variant="outline" size="sm" onClick={handleLogout} className="ml-1">
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Logout
            </Button>
          ) : (
            <Button size="sm" asChild className="ml-1 shadow-sm">
              <Link to="/auth"><LogIn className="w-3.5 h-3.5 mr-1.5" /> Sign In</Link>
            </Button>
          )}
          <ThemeToggle />
        </nav>

        {/* Mobile Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="md:hidden border-t border-border bg-card overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              <Link to="/app" onClick={closeMenu} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                <FileText className="w-4 h-4 text-primary" /> PDF Generator
              </Link>
              <Link to="/images-to-pdf" onClick={closeMenu} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                <ImagePlus className="w-4 h-4 text-primary" /> Images to PDF
              </Link>
              <Link to="/pricing" onClick={closeMenu} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                <DollarSign className="w-4 h-4 text-primary" /> Pricing
              </Link>
              <Link to="/docs" onClick={closeMenu} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                <BookOpen className="w-4 h-4 text-primary" /> API Docs
              </Link>
              <Link to="/blog" onClick={closeMenu} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                <Newspaper className="w-4 h-4 text-primary" /> Blog
              </Link>
              <Link to="/status" onClick={closeMenu} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                <Activity className="w-4 h-4 text-primary" /> Status
              </Link>
              {user && (
                <>
                  <Link to="/analytics" onClick={closeMenu} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                    <TrendingUp className="w-4 h-4 text-primary" /> Analytics
                  </Link>
                  <Link to="/settings" onClick={closeMenu} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm hover:bg-secondary transition-colors">
                    <Settings className="w-4 h-4 text-primary" /> Settings
                  </Link>
                </>
              )}
              <div className="pt-2 border-t border-border">
                {user ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { handleLogout(); closeMenu(); }}>
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </Button>
                ) : (
                  <Button size="sm" className="w-full" asChild onClick={closeMenu}>
                    <Link to="/auth"><LogIn className="w-4 h-4 mr-2" /> Sign In</Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
