import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { verifyResetCode, completePasswordReset, authErrorMessage } from "@/lib/firebase/auth";

/**
 * Handles Firebase's password-reset action link.
 *
 * Firebase appends ?mode=resetPassword&oobCode=... to whatever "Action URL" is
 * configured under Authentication → Templates → Password reset. That must point
 * at this page. If it is left at the Firebase default, users get bounced to an
 * idhtools.firebaseapp.com page mid-flow — which for a product whose pitch is
 * "trust us with your files" reads exactly like a phishing redirect.
 */
const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [accountEmail, setAccountEmail] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  // Validate the link before rendering a form — better to say "this link
  // expired" up front than after the user has typed a password twice.
  useEffect(() => {
    let cancelled = false;
    if (mode !== "resetPassword" || !oobCode) {
      setStatus("invalid");
      return;
    }
    verifyResetCode(oobCode)
      .then((email) => {
        if (cancelled) return;
        setAccountEmail(email);
        setStatus("valid");
      })
      .catch(() => {
        if (!cancelled) setStatus("invalid");
      });
    return () => { cancelled = true; };
  }, [mode, oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (!oobCode) return;
    setLoading(true);
    try {
      await completePasswordReset(oobCode, password);
      toast({ title: "Password updated", description: "Sign in with your new password." });
      navigate("/auth");
    } catch (err) {
      toast({ title: "Could not reset password", description: authErrorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (status === "checking") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
        <div className="flex-1 flex items-center justify-center px-4">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
        <Footer />
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-md p-8 text-center">
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">Link expired</h1>
            <p className="text-muted-foreground text-sm mb-5">
              Password reset links can only be used once, and expire after a while. Request a fresh one and it'll work.
            </p>
            <Button onClick={() => navigate("/auth")} className="rounded-full">Request a new link</Button>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-8">
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Set a new password</h1>
          <p className="text-muted-foreground text-sm mb-6">
            For <span className="text-foreground font-medium">{accountEmail}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">At least 6 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1" />}
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default ResetPassword;
