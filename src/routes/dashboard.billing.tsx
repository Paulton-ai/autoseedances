import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Loader as Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Plan = Tables<"plans">;

export const Route = createFileRoute("/dashboard/billing")({ component: Billing });

function Billing() {
  const { user } = useSession();
  const [current, setCurrent] = useState<string>("free");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("plans").select("*")
      .eq("is_active", true)
      .neq("name", "Free")
      .order("sort_order", { ascending: true })
      .then(({ data }) => { setPlans((data as Plan[]) ?? []); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCurrent(data?.plan ?? "free"));
  }, [user]);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl font-bold">Billing</h1>
      <p className="text-muted-foreground mt-1">Manage your subscription plan.</p>

      <Card className="glass border-0 p-5 mt-6 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Current plan</div>
          <div className="font-display font-bold text-2xl mt-1 capitalize">{current}</div>
        </div>
        <Sparkles className="size-8 text-primary" />
      </Card>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const priceMonthly = Number(plan.price_monthly ?? plan.price_monthly_cents / 100);
            const displayName = plan.display_name || plan.name;
            const isCurrent = current === plan.name.toLowerCase();

            return (
              <Card key={plan.id} className={`glass border-0 p-6 flex flex-col ${plan.name === "Pro" ? "glow-purple ring-2 ring-primary/50" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold">{displayName}</h3>
                  {plan.name === "Pro" && (
                    <Badge className="btn-gradient text-white border-0 text-xs">Popular</Badge>
                  )}
                </div>
                <div className="text-2xl font-display font-bold mb-1">
                  ${priceMonthly.toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  {plan.monthly_credits.toLocaleString()} credits/month
                </div>
                <ul className="space-y-2 text-sm flex-1 mb-5">
                  {((plan.features as string[]) || []).map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="size-4 text-primary shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => toast.info("Stripe checkout coming soon — billing infrastructure is ready.")}
                  className={`w-full ${plan.name === "Pro" ? "btn-gradient text-white border-0" : ""}`}
                  variant={plan.name === "Pro" ? "default" : "outline"}
                  disabled={isCurrent}
                >
                  {isCurrent ? "Current plan" : <>Upgrade <ArrowRight className="ml-1 size-4" /></>}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition">
          View full pricing page <ArrowRight className="inline size-3" />
        </Link>
      </div>
    </div>
  );
}
