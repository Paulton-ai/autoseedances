import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Sparkles, Coins, LogOut, User, Settings } from "lucide-react";
import { signOut } from "@/lib/auth";

interface ToolNavbarProps {
  title: string;
}

export function ToolNavbar({ title }: ToolNavbarProps) {
  const { user } = useSession();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("credit_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setBalance(data?.balance ?? 0));
  }, [user]);

  const initials = user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="size-5" />
          </Link>
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <span className="size-8 rounded-lg btn-gradient grid place-items-center">
              <Sparkles className="size-4 text-white" />
            </span>
            <span className="gradient-text hidden sm:inline">Auto Seedance</span>
          </Link>
          <span className="text-muted-foreground">|</span>
          <span className="font-medium">{title}</span>
        </div>

        <div className="flex items-center gap-4">
          {balance !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
              <Coins className="size-4 text-primary" />
              <span className="font-semibold">{balance}</span>
              <span className="text-xs text-muted-foreground">credits</span>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative size-9 rounded-full">
                <Avatar className="size-9">
                  <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email} />
                  <AvatarFallback className="btn-gradient text-white">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.user_metadata?.display_name || "User"}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/dashboard" className="cursor-pointer">
                  <User className="mr-2 size-4" /> Dashboard
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/dashboard/credits" className="cursor-pointer">
                  <Coins className="mr-2 size-4" /> Credits
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/dashboard/settings" className="cursor-pointer">
                  <Settings className="mr-2 size-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 size-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
