import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, TrendingUp, TrendingDown, ArrowRight, Sparkles, ArrowUpRight, CreditCard, Zap, ShoppingCart } from "lucide-react";
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

type Transaction = Tables<"credits_transactions">;
type Wallet = Tables<"credit_wallets">;

const CREDIT_COSTS = {
  text: 1,
  image: 5,
  video: 30,
  animation: 20,
};

const REASON_ICONS: Record<string, React.ReactNode> = {
  "Signup Bonus": <Sparkles className="size-3" />,
  "Generation: image": <Zap className="size-3" />,
  "Generation: video": <Zap className="size-3" />,
  "Subscription": <ShoppingCart className="size-3" />,
  "Admin Credit": <CreditCard className="size-3" />,
  "Admin Deduction": <CreditCard className="size-3" />,
  "Refund": <TrendingUp className="size-3" />,
  "Referral": <Sparkles className="size-3" />,
  "Daily Bonus": <Sparkles className="size-3" />,
};

function getTransactionIcon(reason: string) {
  return REASON_ICONS[reason] || <TrendingUp className="size-3" />;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CreditsPage() {
  const { user } = useSession();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      const [walletRes, txRes] = await Promise.all([
        supabase.from("credit_wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("credits_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setWallet(walletRes.data as Wallet | null);
      setTransactions((txRes.data as Transaction[]) ?? []);
      setLoading(false);
    }

    fetchData();
  }, [user]);

  // Enable realtime updates
  useEffect(() => {
    if (!user || realtimeEnabled) return;

    const channel = supabase
      .channel("credits_transactions_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credits_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newTx = payload.new as Transaction;
          setTransactions((prev) => [newTx, ...prev]);
          // Update wallet balance
          setWallet((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              balance: newTx.balance_after,
              updated_at: new Date().toISOString(),
            };
          });
        }
      )
      .subscribe();

    setRealtimeEnabled(true);
    return () => {
      channel.unsubscribe();
    };
  }, [user, realtimeEnabled]);

  const usedCredits = wallet ? wallet.monthly_grant - wallet.balance : 0;
  const usagePercent = wallet ? (usedCredits / wallet.monthly_grant) * 100 : 0;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="font-display text-3xl font-bold">Credits</h1>
      <p className="text-muted-foreground mt-1">Manage your AI generation credits</p>

      {loading ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
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

            {transactions.length === 0 ? (
              <div className="mt-6 text-center text-muted-foreground text-sm py-8">
                <Coins className="size-10 mx-auto mb-3 opacity-30" />
                <p>No transactions yet.</p>
                <p className="text-xs mt-1">Generate content or top up your credits to see your history.</p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <div className="hidden sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Reason</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Amount</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((entry) => (
                        <tr key={entry.id} className="border-b border-border/50">
                          <td className="py-3 text-muted-foreground">
                            <div className="font-medium">{formatDate(entry.created_at)}</div>
                            <div className="text-xs">{formatTime(entry.created_at)}</div>
                          </td>
                          <td className="py-3">
                            <Badge
                              variant="outline"
                              className={`border-border ${
                                entry.transaction_type === "credit"
                                  ? "bg-green-500/10 text-green-500 border-green-500/30"
                                  : "bg-red-500/10 text-red-500 border-red-500/30"
                              }`}
                            >
                              <span className="flex items-center gap-1">
                                {getTransactionIcon(entry.reason)}
                                {entry.transaction_type === "credit" ? "Credit" : "Debit"}
                              </span>
                            </Badge>
                          </td>
                          <td className="py-3 text-foreground">{entry.reason}</td>
                          <td className={`py-3 text-right font-medium ${
                            entry.transaction_type === "credit" ? "text-green-500" : "text-red-500"
                          }`}>
                            {entry.transaction_type === "credit" ? (
                              <span className="flex items-center justify-end gap-1">
                                <TrendingUp className="size-3" />+{entry.amount}
                              </span>
                            ) : (
                              <span className="flex items-center justify-end gap-1">
                                <TrendingDown className="size-3" />-{entry.amount}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right font-medium text-muted-foreground">
                            {entry.balance_after}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view */}
                <div className="sm:hidden space-y-3">
                  {transactions.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-border bg-muted/30 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {formatDate(entry.created_at)} {formatTime(entry.created_at)}
                        </div>
                        <Badge
                          variant="outline"
                          className={`border-border text-xs ${
                            entry.transaction_type === "credit"
                              ? "bg-green-500/10 text-green-500 border-green-500/30"
                              : "bg-red-500/10 text-red-500 border-red-500/30"
                          }`}
                        >
                          {entry.transaction_type === "credit" ? "Credit" : "Debit"}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium">{entry.reason}</div>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${
                          entry.transaction_type === "credit" ? "text-green-500" : "text-red-500"
                        }`}>
                          {entry.transaction_type === "credit" ? "+" : "-"}{entry.amount}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Balance: {entry.balance_after}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
