import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Settings, BookOpen, TrendingUp, Activity, Newspaper, KeyRound,
  FileText, LogOut, User as UserIcon, ShieldCheck,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Props { user: User }

export const ProfileMenu = ({ user }: Props) => {
  const { isAdmin } = useIsAdmin();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0);
  const [displayName, setDisplayName] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled && data?.display_name) setDisplayName(data.display_name); });
    return () => { cancelled = true; };
  }, [user.id]);

  const name = displayName || user.email || "Account";
  const initials = (name || "U").slice(0, 2).toUpperCase();

  const handleConfirmLogout = async () => {
    if (confirmStep < 1) {
      setConfirmStep(confirmStep + 1);
      return;
    }
    await supabase.auth.signOut();
    setConfirmOpen(false);
    setConfirmStep(0);
    navigate("/");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild><Link to="/settings"><UserIcon className="w-4 h-4 mr-2" /> Profile & Settings</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/settings#api"><KeyRound className="w-4 h-4 mr-2" /> API Keys</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/settings#documents"><FileText className="w-4 h-4 mr-2" /> Recent Documents</Link></DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild><Link to="/analytics"><TrendingUp className="w-4 h-4 mr-2" /> Analytics</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/docs"><BookOpen className="w-4 h-4 mr-2" /> API Documentation</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/status"><Activity className="w-4 h-4 mr-2" /> Status</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/blog"><Newspaper className="w-4 h-4 mr-2" /> Blog</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link to="/privacy"><ShieldCheck className="w-4 h-4 mr-2" /> Privacy</Link></DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/admin/security" className="text-destructive focus:text-destructive">
                  <ShieldCheck className="w-4 h-4 mr-2" /> Admin · Security
                </Link>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          {/* Buried logout — bottom, muted, requires confirm */}
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); setConfirmStep(0); setConfirmOpen(true); }}
            className="text-muted-foreground/70 text-xs focus:text-destructive"
          >
            <LogOut className="w-3.5 h-3.5 mr-2 opacity-60" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmStep(0); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmStep === 0 ? "Are you sure you want to sign out?" : "Really sign out?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStep === 0
                ? "You'll lose access to your API keys, recent documents, and unlimited generations until you sign back in."
                : "This is your final confirmation. Click \"Yes, sign me out\" to leave, or Cancel to stay signed in."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLogout} className="bg-destructive hover:bg-destructive/90">
              {confirmStep === 0 ? "Continue" : "Yes, sign me out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
