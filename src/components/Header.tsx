import { LogIn, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileMenu } from "@/components/ProfileMenu";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";

const NAV = [
  { to: "/create", label: "Create" },
  { to: "/app", label: "Text to PDF" },
  { to: "/images-to-pdf", label: "Images to PDF" },
  { to: "/docs", label: "API Docs" },
  { to: "/pricing", label: "Pricing" },
];

export const Header = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };
  const closeMenu = () => setMobileOpen(false);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-shadow duration-300 backdrop-blur-xl bg-background/85 border-b ${
          scrolled ? "border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)]" : "border-transparent"
        }`}
      >
        <div className="container mx-auto px-5 py-3.5 flex items-center justify-between max-w-7xl">
          <Link to="/" className="flex flex-col leading-none group">
            <span className="font-display font-bold text-[22px] text-foreground tracking-tight group-hover:text-primary transition-colors">PDFly</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">by 3idhMinds</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {NAV.map(n => (
              <Link key={n.to} to={n.to} className="nav-link">{n.label}</Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <ProfileMenu user={user} />
            ) : (
              <Button size="sm" variant="ghost" asChild className="text-sm">
                <Link to="/auth"><LogIn className="w-3.5 h-3.5 mr-1.5" /> Sign In</Link>
              </Button>
            )}
          </div>

          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Fullscreen mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-background md:hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <span className="font-display font-bold text-[22px]">PDFly</span>
              <Button variant="ghost" size="sm" onClick={closeMenu} aria-label="Close menu"><X className="w-5 h-5" /></Button>
            </div>
            <nav className="flex-1 flex flex-col justify-center px-8 gap-2">
              {NAV.map((n, i) => (
                <motion.div
                  key={n.to}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.06, duration: 0.35, ease: "easeOut" }}
                >
                  <Link
                    to={n.to}
                    onClick={closeMenu}
                    className="block font-display text-4xl font-bold tracking-tight py-3 text-foreground hover:text-primary transition-colors"
                  >
                    {n.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="p-6 border-t border-border">
              {user ? (
                <Button variant="outline" className="w-full" onClick={() => { handleLogout(); closeMenu(); }}>
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </Button>
              ) : (
                <Button className="w-full h-12 text-base" asChild onClick={closeMenu}>
                  <Link to="/auth"><LogIn className="w-4 h-4 mr-2" /> Sign In</Link>
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
