import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Lock, Clock } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { SITE_URL } from "@/lib/config";
import { signInWithGoogle, authErrorMessage } from "@/lib/firebase/auth";

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="w-[18px] h-[18px]" aria-hidden="true">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z" />
    <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z" />
    <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 4.2 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z" />
  </svg>
);

/**
 * Google-only sign-in for now.
 *
 * Email/password is still fully wired on the backend — Firebase has the
 * provider enabled and `signUpWithEmail`/`signInWithEmail` are untouched in
 * lib/firebase/auth.ts. Only this UI hides it, and only because the password
 * reset Action URL cannot be configured until the custom sender domain finishes
 * verifying. Shipping a signup path whose recovery flow is half-configured
 * means locking people out of their own accounts, which is worse than one
 * fewer button.
 *
 * To restore: put the form back. No backend change required.
 */
const Auth = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Same-origin `next` only. The `//` check blocks protocol-relative URLs like
  // //evil.com, which would otherwise be an open redirect.
  const rawNext = searchParams.get("next") ?? "";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      // null means we fell back to a redirect — the page is navigating away.
      if (user) {
        toast({ title: "Welcome!" });
        navigate(safeNext);
      }
    } catch (err) {
      toast({ title: "Sign-in failed", description: authErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <SEOHead
        title="Sign In — PDFly by 3idhMinds"
        description="Sign in to PDFly to manage your API keys and usage. The web PDF tools are free and need no account at all."
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
            An account is only for API keys. Every PDF tool on the site works without one.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-xs text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span>All systems operational</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 bg-background min-h-screen">
        <div className="max-w-md w-full mx-auto">
          <div className="md:hidden mb-8 flex flex-col leading-none">
            <span className="font-display font-bold text-2xl">PDFly</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">by 3idhMinds</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
            Sign in or sign up
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            One button. Same account whether you're new or returning.
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full h-12 rounded-full text-base font-medium gap-3 border-border hover:bg-muted/60"
          >
            <GoogleMark />
            {loading ? "Opening Google…" : "Continue with Google"}
          </Button>

          {/* Email/password: temporarily hidden, honestly labelled. */}
          <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-4">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-foreground">Email and password — coming soon</p>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  Temporarily unavailable while we finish configuring password recovery.
                  We'd rather not hand you an account you could get locked out of.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
            One account for every 3idhMinds tool.<br className="sm:hidden" />
            {" "}Sign in once — whatever we build next, you're already in.
          </p>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
              <span>
                You don't need an account to use PDFly. Merge, split, compress and convert all run
                in your browser, for free, signed in or not — an account only exists so we can issue
                you an API key.{" "}
                <Link to="/" className="text-primary hover:underline">Back to the tools</Link>
              </span>
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-6">
            By continuing you agree to our{" "}
            <Link to="/terms" className="text-primary hover:underline">Terms</Link> and{" "}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
