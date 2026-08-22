import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "@/lib/firebase/auth";
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
  BookOpen, Activity, Newspaper, KeyRound,
  LogOut, ShieldCheck,
} from "lucide-react";
import type { User } from "firebase/auth";

import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Props { user: User }

export const ProfileMenu = ({ user }: Props) => {
  const { isAdmin } = useIsAdmin();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();

  // Firebase carries displayName on the user object itself, so the extra
  // round-trip to a `profiles` table this used to do is gone.
  const name = user.displayName || user.email || "Account";
  const initials = (name || "U").slice(0, 2).toUpperCase();

  /**
   * Sign out was unreachable, and the two-step confirm was the reason.
   *
   * Radix's AlertDialogAction closes the dialog on click. The old handler used
   * that same click to advance a step counter, and the dialog's onOpenChange
   * reset the counter to 0 on close. So clicking "Continue" closed the dialog
   * and reset the step — step 1 could never be reached and sign-out never ran.
   * No error, no network request, nothing: exactly the reported symptom.
   *
   * Removed the step counter rather than patching it. Signing out is not
   * destructive — you sign back in — and asking twice to confirm a reversible
   * action is a dark pattern, not a safeguard.
   */
  const handleConfirmLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      setConfirmOpen(false);
      navigate("/");
    } finally {
      setSigningOut(false);
    }
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

          {/* One entry, not four. "Profile & Settings", "API Keys" and
              "Recent Documents" were three menu items that all opened the same
              page — the last two only differed by a #hash. Analytics was a
              fourth route holding one chart. Three labels for one destination
              reads as broken navigation, because it is. */}
          <DropdownMenuItem asChild>
            <Link to="/settings"><KeyRound className="w-4 h-4 mr-2" /> API dashboard</Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

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
            onSelect={(e) => { e.preventDefault(); setConfirmOpen(true); }}
            className="text-muted-foreground/70 text-xs focus:text-destructive"
          >
            <LogOut className="w-3.5 h-3.5 mr-2 opacity-60" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of PDFly?</AlertDialogTitle>
            <AlertDialogDescription>
              Your API keys and usage stay exactly as they are — sign back in any time to reach them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLogout} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
