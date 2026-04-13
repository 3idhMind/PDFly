import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") === "recovery") {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated!", description: "You can now sign in with your new password" });
      navigate("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-md p-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Link</h1>
            <p className="text-muted-foreground text-sm mb-4">This password reset link is invalid or has expired.</p>
            <Button onClick={() => navigate("/auth")}>Back to Sign In</Button>
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
          <h1 className="text-2xl font-bold text-foreground mb-2">Set New Password</h1>
          <p className="text-muted-foreground text-sm mb-6">Enter your new password below</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : <><KeyRound className="w-4 h-4 mr-1" /> Update Password</>}
            </Button>
          </form>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default ResetPassword;
