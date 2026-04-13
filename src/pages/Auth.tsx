import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, ArrowLeft, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";

type AuthView = "login" | "signup" | "forgot";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) {
        toast({ title: "Error", description: String(result.error), variant: "destructive" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const title = view === "login" ? "Welcome Back" : view === "signup" ? "Create Account" : "Reset Password";
  const subtitle = view === "login"
    ? "Sign in to manage your API keys and usage"
    : view === "signup"
    ? "Sign up to get your own API key"
    : "Enter your email and we'll send you a reset link";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-8">
          <Button variant="ghost" size="sm" onClick={() => view === "forgot" ? setView("login") : navigate("/")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-muted-foreground text-sm mb-6">{subtitle}</p>

          {view !== "forgot" && (
            <>
              <Button
                variant="outline"
                className="w-full mb-4"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>
              <div className="relative mb-4">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                  or
                </span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === "signup" && (
              <div>
                <Label htmlFor="name">Display Name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            {view !== "forgot" && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : view === "login" ? (<><LogIn className="w-4 h-4 mr-1" /> Sign In</>) : view === "signup" ? (<><UserPlus className="w-4 h-4 mr-1" /> Sign Up</>) : (<><Mail className="w-4 h-4 mr-1" /> Send Reset Link</>)}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            {view === "login" && (
              <button onClick={() => setView("forgot")} className="block w-full text-sm text-muted-foreground hover:text-primary hover:underline">
                Forgot your password?
              </button>
            )}
            <button onClick={() => setView(view === "login" ? "signup" : "login")} className="text-sm text-primary hover:underline">
              {view === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Auth;
