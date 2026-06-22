import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Coins, TrendingUp, TrendingDown, ArrowRight, Sparkles, ArrowUpRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/dashboard/credits")({
  component: CreditsPage,
  head: () => ({
    meta: [
      { title: "Credits — Auto Seedance AI" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type LedgerEntry = Tables<"credit_ledger">;
type Wallet = Tables<"credit_wallets">;

const CREDIT_COSTS = {
  text: 1,
  image: 5,
  video: 30,
  animation: 20,
};

function CreditsPage() {
  const { user } = useSession();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      const [walletRes, ledgerRes] = await Promise.all([
        supabase.from("credit_wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("credit_ledger")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setWallet(walletRes.data as Wallet | null);
      setLedger((ledgerRes.data as LedgerEntry[]) ?? []);
      setLoading(false);
    }

    fetchData();
  }, [user]);

  const usedCredits = wallet ? wallet.monthly_grant - wallet.balance : 0;
  const usagePercent = wallet ? (usedCredits / wallet.monthly_grant) * 100 : 0;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="font-display text-3xl font-bold">Credits</h1>
      <p className="text-muted-foreground mt-1">Manage your AI generation credits</p>

      {loading ? (
        <div className="mt-8 grid place-items-center">
          <Sparkles className="size-8 animate-pulse text-primary" />
        </div>
      ) : (
        <>
          {/* Balance card */}
          <Card className="glass border-0 p-6 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Coins className="size-4 text-primary" /> Current balance
                </div>
                <div className="text-5xl font-display font-bold mt-2">
                  {wallet?.balance.toLocaleString() ?? 0}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  of {wallet?.monthly_grant.toLocaleString() ?? 50} monthly credits
                </div>
              </div>
              <div className="hidden sm:block">
                <Link to="/pricing">
                  <Button className="btn-gradient text-white border-0">
                    Upgrade <ArrowRight className="size-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Used this period</span>
                <span className="font-medium">{usedCredits} credits</span>
              </div>
              <Progress value={Math.min(100, usagePercent)} className="h-3" />
            </div>

            <div className="sm:hidden mt-4">
              <Link to="/pricing" className="block">
                <Button className="w-full btn-gradient text-white border-0">
                  Upgrade <ArrowUpRight className="size-4 ml-1" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Credit costs */}
          <Card className="glass border-0 p-6 mt-4">
            <h2 className="font-display font-semibold">Credit costs per generation</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              {Object.entries(CREDIT_COSTS).map(([tool, cost]) => (
                <div key={tool} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <div className="text-sm text-muted-foreground capitalize">{tool}</div>
                  <div className="text-xl font-semibold mt-1">{cost}</div>
                  <div className="text-xs text-muted-foreground">credits</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Transaction history */}
          <Card className="glass border-0 p-6 mt-6">
            <h2 className="font-display font-semibold">Transaction history</h2>

            {ledger.length === 0 ? (
              <div className="mt-6 text-center text-muted-foreground text-sm">
                No transactions yet. Generate content to see your history.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Tool</th>
                      <th className="text-left py-2 font-medium text-muted-foreground">Reason</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/50">
                        <td className="py-3 text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          {entry.tool && (
                            <Badge variant="outline" className="border-border capitalize">
                              {entry.tool}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3">{entry.reason}</td>
                        <td className={`py-3 text-right font-medium ${entry.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                          {entry.amount > 0 ? (
                            <span className="flex items-center justify-end gap-1">
                              <TrendingUp className="size-3" />+{entry.amount}
                            </span>
                          ) : (
                            <span className="flex items-center justify-end gap-1">
                              <TrendingDown className="size-3" />{entry.amount}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
