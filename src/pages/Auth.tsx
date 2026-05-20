import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { SITE_URL } from "@/lib/config";

type AuthView = "login" | "signup" | "forgot";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === "signup" && !acceptedTerms) {
      toast({ title: "Please accept the Terms & Privacy Policy to continue", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "We sent you a password reset link" });
        return;
      }
      if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Logged in successfully" });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email },
          },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Check your email to confirm your account" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const title = view === "login" ? "Welcome back" : view === "signup" ? "Create your account" : "Reset your password";
  const subtitle = view === "login"
    ? "Sign in to manage your API keys and usage."
    : view === "signup"
    ? "Sign up to get your own API key. Free forever."
    : "Enter your email — we'll send you a reset link.";

  const cta = view === "login" ? "Sign In" : view === "signup" ? "Create Account" : "Send Reset Link";

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <SEOHead
        title="Sign In or Sign Up — PDFly by 3idhMinds"
        description="Sign in or create a free PDFly account to get API keys, manage rate limits, and access usage analytics for PDF generation."
        canonical={`${SITE_URL}/auth`}
      />
      {/* Left brand panel */}
      <div className="hidden md:flex relative bg-[#0D0D0D] text-white flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, hsl(175 100% 35% / 0.5), transparent 50%), radial-gradient(circle at 80% 80%, hsl(175 100% 35% / 0.3), transparent 50%)",
        }} />
        <div className="relative z-10">
          <Link to="/" className="inline-flex flex-col leading-none">
            <span className="font-display font-bold text-3xl">PDFly</span>
            <span className="text-xs text-white/60 mt-1">by 3idhMinds</span>
          </Link>
        </div>
        <div className="relative z-10">
          <p className="font-serif-display text-[44px] leading-[1.05] italic text-white mb-6">
            Your documents.<br/>Your privacy.<br/>Your API.
          </p>
          <p className="text-sm text-white/60 max-w-sm">
            The only free PDF API where your files never leave your browser.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-xs text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span>All systems operational</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 bg-background min-h-screen">
        <div className="max-w-md w-full mx-auto">
          <div className="md:hidden mb-8 flex flex-col leading-none">
            <span className="font-display font-bold text-2xl">PDFly</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">by 3idhMinds</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => view === "forgot" ? setView("login") : navigate("/")}
            className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm mb-8">{subtitle}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Display Name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="h-12 rounded-full px-5 focus-visible:ring-primary" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-12 rounded-full px-5 focus-visible:ring-primary" />
            </div>
            {view !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-12 rounded-full px-5 focus-visible:ring-primary" />
              </div>
            )}
            {view === "signup" && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={(c) => setAcceptedTerms(c === true)}
                  className="mt-0.5"
                  required
                />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link>{" "}and{" "}
                  <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.
                </span>
              </label>
            )}
            <Button
              type="submit"
              className="w-full h-12 rounded-full text-base font-medium btn-press bg-primary hover:bg-primary/90"
              disabled={loading || (view === "signup" && !acceptedTerms)}
            >
              {loading ? "Loading..." : (
                <span className="inline-flex items-center gap-2">
                  {view === "forgot" ? <Mail className="w-4 h-4" /> : null}
                  {cta}
                  {view !== "forgot" && <ArrowRight className="w-4 h-4" />}
                </span>
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-5">
            No credit card. No subscription. No tricks.
          </p>

          <div className="mt-8 text-center space-y-2">
            {view === "login" && (
              <button onClick={() => setView("forgot")} className="block w-full text-sm text-muted-foreground hover:text-primary transition-colors">
                Forgot your password?
              </button>
            )}
            <button onClick={() => setView(view === "login" ? "signup" : "login")} className="text-sm text-foreground hover:text-primary transition-colors">
              {view === "login" ? "Don't have an account? " : "Already have an account? "}
              <span className="font-medium underline underline-offset-4">{view === "login" ? "Sign up" : "Sign in"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
