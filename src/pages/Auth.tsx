import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, ArrowLeft, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";

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
            {view === "signup" && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={(c) => setAcceptedTerms(c === true)}
                  className="mt-0.5"
                  required
                />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link>
                  {" "}and{" "}
                  <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.
                </span>
              </label>
            )}
            <Button type="submit" className="w-full" disabled={loading || (view === "signup" && !acceptedTerms)}>
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
