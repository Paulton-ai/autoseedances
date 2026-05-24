import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, Mail, Lock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Auto Seedance" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});


function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid-bg grid place-items-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6 font-display font-bold text-xl">
          <span className="size-9 rounded-lg btn-gradient grid place-items-center">
            <Sparkles className="size-5 text-white" />
          </span>
          <span className="gradient-text">Auto Seedance</span>
        </Link>
        <Card className="glass border-0 p-8">
          <h1 className="text-2xl font-display font-bold text-center">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            {mode === "signin" ? "Sign in to your dashboard" : "Start automating in minutes"}
          </p>
          <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full mt-6 border-border bg-muted/50">
            <GoogleIcon /> Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px bg-muted flex-1" /> or <div className="h-px bg-muted flex-1" />
          </div>
          <form onSubmit={handleEmail} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label>Display name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" required className="mt-1 bg-muted/50 border-border" />
              </div>
            )}
            <div>
              <Label>Email</Label>
              <div className="relative mt-1">
                <Mail className="size-4 text-muted-foreground absolute left-3 top-3" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" required className="pl-9 bg-muted/50 border-border" />
              </div>
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative mt-1">
                <Lock className="size-4 text-muted-foreground absolute left-3 top-3" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="pl-9 bg-muted/50 border-border" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full btn-gradient text-white border-0">
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center mt-5">
            {mode === "signin" ? "No account? " : "Already have an account? "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary hover:underline">
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4 mr-2" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5c1.6 0 3 .55 4.1 1.6L19 4c-1.9-1.7-4.3-2.7-7-2.7C7 1.3 2.7 4.5 1 9l3.4 2.6C5.3 8.4 8.4 5 12 5z"/>
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.3H12v4.5h6.2c-.3 1.4-1.1 2.6-2.4 3.4l3.3 2.6c2-1.8 3.1-4.5 3.1-8.2z"/>
      <path fill="#FBBC05" d="M4.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4L1 7C.4 8.5 0 10.2 0 12s.4 3.5 1 5l3.4-2.6z"/>
      <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7L15.8 17.7c-1 .7-2.3 1.1-3.8 1.1-3.6 0-6.7-2.4-7.6-5.7L1 15.7C2.7 19.5 7 23 12 23z"/>
    </svg>
  );
}
