import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader as Loader2, Users, CreditCard, Zap, Settings, Mail, Search,
  Pencil, Send, Image as ImageIcon, Video, DollarSign, RefreshCw,
  Database, Shield, Globe, Plus, Trash2, Check, X, TrendingUp, Clock,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/dashboard/admin")({ component: Admin });

type Profile = Tables<"profiles">;
type Subscription = Tables<"subscriptions">;
type Plan = Tables<"plans">;
type Generation = Tables<"generations">;

interface UserWithSub extends Profile {
  subscriptions: Subscription | null;
  email?: string;
}

interface SiteSettings {
  site_name: string;
  support_email: string;
  free_signup_credits: number;
  max_images_per_day: number;
  max_videos_per_day: number;
  maintenance_mode: boolean;
}

interface EmailCampaign {
  id: string;
  subject: string;
  recipient_type: string;
  recipient_count: number;
  status: string;
  created_at: string;
}

const EMAIL_TEMPLATES = [
  {
    name: "Welcome Email",
    subject: "Welcome to Auto Seedance! 🎉",
    body: `<h2>Welcome to Auto Seedance!</h2>
<p>We're thrilled to have you on board. You now have access to powerful AI image and video generation tools.</p>
<p><strong>Getting started:</strong></p>
<ul>
  <li>Visit the <a href="https://autoseedance.site/tools/image">Image Generation</a> tool</li>
  <li>Try the <a href="https://autoseedance.site/tools/video">Video Generation</a> tool</li>
  <li>Check your <a href="https://autoseedance.site/dashboard/credits">credit balance</a></li>
</ul>
<p>Happy creating!</p>`,
  },
  {
    name: "New Feature Announcement",
    subject: "New Features Available on Auto Seedance ✨",
    body: `<h2>Exciting New Features!</h2>
<p>We've been working hard to bring you new capabilities on Auto Seedance.</p>
<p>Check out what's new in your dashboard today.</p>`,
  },
  {
    name: "Special Offer",
    subject: "Exclusive Offer: Upgrade Your Plan Today 🚀",
    body: `<h2>Special Offer Just for You!</h2>
<p>As a valued member, we're offering you an exclusive discount on our paid plans.</p>
<p>Upgrade today to get more credits and priority generation.</p>`,
  },
  {
    name: "Maintenance Notice",
    subject: "Scheduled Maintenance — Auto Seedance",
    body: `<h2>Scheduled Maintenance Notice</h2>
<p>We will be performing scheduled maintenance on our platform. During this time, the service may be temporarily unavailable.</p>
<p>We apologize for any inconvenience and will notify you when service is restored.</p>`,
  },
];

function Admin() {
  const { user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Overview stats
  const [stats, setStats] = useState({
    users: 0,
    paid: 0,
    generationsToday: 0,
    creditsUsedToday: 0,
  });
  const [recentUsers, setRecentUsers] = useState<UserWithSub[]>([]);
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([]);

  // Users
  const [users, setUsers] = useState<UserWithSub[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [creditModal, setCreditModal] = useState<{ user: UserWithSub; mode: "add" | "remove" } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [planModal, setPlanModal] = useState<UserWithSub | null>(null);
  const [newPlan, setNewPlan] = useState<string>("free");
  const [wallets, setWallets] = useState<Map<string, number>>(new Map());

  // Plans
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPlan, setEditingPlan] = useState<Plan & { price_monthly_edit?: number; price_yearly_edit?: number } | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [newFeature, setNewFeature] = useState("");

  // Campaigns
  const [campaignTo, setCampaignTo] = useState<"all" | "free" | "paid" | "specific">("all");
  const [specificEmail, setSpecificEmail] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignBody, setCampaignBody] = useState("");
  const [sending, setSending] = useState(false);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Settings
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    site_name: "Auto Seedance",
    support_email: "support@autoseedance.site",
    free_signup_credits: 50,
    max_images_per_day: 20,
    max_videos_per_day: 5,
    maintenance_mode: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    (async () => {
      const { data } = await supabase.from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!data) { setAllowed(false); return; }
      setAllowed(true);
      fetchAll();
    })();
  }, [user, sessionLoading]);

  function fetchAll() {
    fetchStats();
    fetchUsers();
    fetchPlans();
    fetchCampaigns();
    fetchSiteSettings();
  }

  async function fetchStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [usersRes, paidRes, genTodayRes, creditLedgerRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).neq("plan", "free"),
      supabase.from("generations").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
      supabase.from("credit_ledger").select("amount").gte("created_at", todayIso).lt("amount", 0),
    ]);

    const creditsConsumedToday = Math.abs(
      creditLedgerRes.data?.reduce((s, e) => s + (e.amount || 0), 0) || 0
    );

    setStats({
      users: usersRes.count ?? 0,
      paid: paidRes.count ?? 0,
      generationsToday: genTodayRes.count ?? 0,
      creditsUsedToday: creditsConsumedToday,
    });

    // Recent signups (last 10)
    const { data: recentProfiles } = await supabase.from("profiles")
      .select("*").order("created_at", { ascending: false }).limit(10);
    if (recentProfiles) {
      const ids = recentProfiles.map(p => p.id);
      const { data: subs } = await supabase.from("subscriptions").select("*").in("user_id", ids);
      const subMap = new Map(subs?.map(s => [s.user_id, s]));
      setRecentUsers(recentProfiles.map(p => ({ ...p, subscriptions: subMap.get(p.id) || null })));
    }

    // Recent generations (last 10)
    const { data: genData } = await supabase.from("generations")
      .select("*").order("created_at", { ascending: false }).limit(10);
    setRecentGenerations((genData as Generation[]) ?? []);
  }

  async function fetchUsers() {
    const { data: profiles } = await supabase.from("profiles")
      .select("*").order("created_at", { ascending: false }).limit(200);
    if (!profiles) return;

    const ids = profiles.map(p => p.id);
    const [{ data: subs }, { data: walletsData }] = await Promise.all([
      supabase.from("subscriptions").select("*").in("user_id", ids),
      supabase.from("credit_wallets").select("user_id, balance").in("user_id", ids),
    ]);

    const subMap = new Map(subs?.map(s => [s.user_id, s]));
    const walletMap = new Map(walletsData?.map(w => [w.user_id, w.balance]));
    setWallets(walletMap);
    setUsers(profiles.map(p => ({ ...p, subscriptions: subMap.get(p.id) || null })));
  }

  async function fetchPlans() {
    const { data } = await supabase.from("plans").select("*").order("sort_order", { ascending: true });
    setPlans((data as Plan[]) ?? []);
  }

  async function fetchCampaigns() {
    const { data } = await supabase.from("email_campaigns")
      .select("id, subject, recipient_type, recipient_count, status, created_at")
      .order("created_at", { ascending: false }).limit(20);
    setCampaigns((data as EmailCampaign[]) ?? []);
  }

  async function fetchSiteSettings() {
    const { data } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (data) setSiteSettings(data as SiteSettings);
  }

  async function handleAddRemoveCredits() {
    if (!creditModal || !creditAmount) return;
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    const finalAmount = creditModal.mode === "remove" ? -amount : amount;
    const userId = creditModal.user.id;

    // Get current balance
    const { data: wallet } = await supabase.from("credit_wallets")
      .select("balance").eq("user_id", userId).maybeSingle();
    if (!wallet) { toast.error("Wallet not found"); return; }

    const newBalance = Math.max(0, wallet.balance + finalAmount);
    const [walletRes, ledgerRes] = await Promise.all([
      supabase.from("credit_wallets").update({ balance: newBalance }).eq("user_id", userId),
      supabase.from("credit_ledger").insert({
        user_id: userId,
        amount: finalAmount,
        balance_after: newBalance,
        reason: creditReason || (creditModal.mode === "add" ? "Admin credit grant" : "Admin credit removal"),
      }),
    ]);

    if (walletRes.error || ledgerRes.error) { toast.error("Failed to update credits"); return; }
    toast.success(`${creditModal.mode === "add" ? "Added" : "Removed"} ${amount} credits`);
    setCreditModal(null);
    setCreditAmount("");
    setCreditReason("");
    fetchUsers();
  }

  async function handleChangePlan() {
    if (!planModal) return;
    const { error } = await supabase.from("subscriptions")
      .upsert({ user_id: planModal.id, plan: newPlan as any, status: "active" }, { onConflict: "user_id" });
    if (error) { toast.error("Failed to update plan"); return; }
    toast.success("Plan updated");
    setPlanModal(null);
    fetchUsers();
  }

  async function updatePlan() {
    if (!editingPlan) return;
    const priceMonthly = editingPlan.price_monthly_edit ?? Number(editingPlan.price_monthly ?? 0);
    const priceYearly = editingPlan.price_yearly_edit ?? Number(editingPlan.price_yearly ?? 0);
    const { error } = await supabase.from("plans").update({
      display_name: editingPlan.display_name,
      price_monthly_cents: Math.round(priceMonthly * 100),
      price_yearly_cents: Math.round(priceYearly * 100),
      monthly_credits: editingPlan.monthly_credits,
      features: editingPlan.features,
      is_active: editingPlan.is_active,
    }).eq("id", editingPlan.id);

    if (error) { toast.error("Failed to update plan"); return; }
    toast.success("Plan updated — pricing page will reflect changes immediately");
    setPlanDialogOpen(false);
    setEditingPlan(null);
    fetchPlans();
  }

  function addFeature() {
    if (!editingPlan || !newFeature.trim()) return;
    setEditingPlan({ ...editingPlan, features: [...(editingPlan.features as string[]), newFeature.trim()] });
    setNewFeature("");
  }

  function removeFeature(idx: number) {
    if (!editingPlan) return;
    const feats = [...(editingPlan.features as string[])];
    feats.splice(idx, 1);
    setEditingPlan({ ...editingPlan, features: feats });
  }

  async function sendCampaign() {
    if (!campaignSubject.trim() || !campaignBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    if (campaignTo === "specific" && !specificEmail.trim()) {
      toast.error("Enter a recipient email");
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          recipient_type: campaignTo,
          specific_email: campaignTo === "specific" ? specificEmail.trim() : undefined,
          subject: campaignSubject,
          html_body: campaignBody,
          sent_by: user?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success(`Campaign sent to ${json.sent_count} recipients`);
      setCampaignSubject("");
      setCampaignBody("");
      setSpecificEmail("");
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || "Failed to send campaign");
    } finally {
      setSending(false);
    }
  }

  async function saveSiteSettings() {
    setSavingSettings(true);
    const { error } = await supabase.from("site_settings")
      .update({ ...siteSettings, updated_at: new Date().toISOString() }).eq("id", 1);
    setSavingSettings(false);
    if (error) { toast.error("Failed to save settings"); return; }
    toast.success("Settings saved");
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = !userSearch ||
      u.display_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.id.toLowerCase().includes(userSearch.toLowerCase());
    const matchesPlan = userFilter === "all" || (u.subscriptions?.plan || "free") === userFilter;
    return matchesSearch && matchesPlan;
  });

  if (allowed === null) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Card className="glass border-0 p-8 text-center">
          <Shield className="size-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Admin Access Required</h2>
          <p className="text-muted-foreground mt-2">You don't have permission to view this page.</p>
          <Button onClick={() => navigate({ to: "/dashboard" })} className="mt-4">Go to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground mt-1">Full control over users, plans, and platform settings</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="size-4 mr-2" /> Refresh
          </Button>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background">
              <Zap className="size-4 mr-1.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-background">
              <Users className="size-4 mr-1.5" /> Users
            </TabsTrigger>
            <TabsTrigger value="plans" className="data-[state=active]:bg-background">
              <CreditCard className="size-4 mr-1.5" /> Plans
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="data-[state=active]:bg-background">
              <Mail className="size-4 mr-1.5" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-background">
              <Settings className="size-4 mr-1.5" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Users", value: stats.users, icon: Users, color: "text-blue-400" },
                { label: "Paid Subscribers", value: stats.paid, icon: CreditCard, color: "text-green-400" },
                { label: "Generations Today", value: stats.generationsToday, icon: Zap, color: "text-amber-400" },
                { label: "Credits Used Today", value: stats.creditsUsedToday.toLocaleString(), icon: Database, color: "text-rose-400" },
              ].map(s => (
                <Card key={s.label} className="glass border-0 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <s.icon className={`size-5 ${s.color}`} />
                  </div>
                  <div className="mt-2 text-3xl font-display font-bold">{s.value}</div>
                </Card>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="glass border-0 p-6">
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                  <Users className="size-4" /> Recent Signups
                </h3>
                <div className="space-y-3">
                  {recentUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary/50 grid place-items-center text-white text-xs font-bold shrink-0">
                        {(u.display_name?.[0] || "U").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{u.display_name || "Unnamed"}</div>
                        <div className="text-xs text-muted-foreground">{u.id.slice(0, 12)}…</div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {recentUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No users yet</p>
                  )}
                </div>
              </Card>

              <Card className="glass border-0 p-6">
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                  <Zap className="size-4" /> Recent Generations
                </h3>
                <div className="space-y-3">
                  {recentGenerations.map(g => (
                    <div key={g.id} className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-muted overflow-hidden shrink-0">
                        {g.thumbnail_url || g.result_url ? (
                          <img src={g.thumbnail_url || g.result_url || ""} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="size-full grid place-items-center">
                            {g.tool_type === "video" ? <Video className="size-4 text-muted-foreground" /> : <ImageIcon className="size-4 text-muted-foreground" />}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{g.prompt}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs px-1 py-0">{g.tool_type}</Badge>
                          <span className="text-xs text-muted-foreground">{g.credits_used} cr</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {g.status === "done" ? <Check className="size-4 text-green-400" /> :
                         g.status === "failed" ? <X className="size-4 text-red-400" /> :
                         <Clock className="size-4 text-amber-400" />}
                      </div>
                    </div>
                  ))}
                  {recentGenerations.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No generations yet</p>
                  )}
                </div>
              </Card>
            </div>

            <Card className="glass border-0 p-6">
              <h3 className="font-display font-semibold mb-4">Quick Actions</h3>
              <div className="grid sm:grid-cols-4 gap-3">
                {[
                  { label: "Manage Users", icon: Users, tab: "users" },
                  { label: "Edit Plans", icon: CreditCard, tab: "plans" },
                  { label: "Send Campaign", icon: Mail, tab: "campaigns" },
                  { label: "Site Settings", icon: Settings, tab: "settings" },
                ].map(a => (
                  <Button key={a.tab} variant="outline" className="justify-start" onClick={() => setActiveTab(a.tab)}>
                    <a.icon className="size-4 mr-2" /> {a.label}
                  </Button>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ── USERS ── */}
          <TabsContent value="users">
            <Card className="glass border-0 p-6">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search by name or ID…" className="pl-9"
                    value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                </div>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="All plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 font-medium text-muted-foreground">User</th>
                      <th className="text-left py-3 font-medium text-muted-foreground">Plan</th>
                      <th className="text-right py-3 font-medium text-muted-foreground">Credits</th>
                      <th className="text-left py-3 font-medium text-muted-foreground">Joined</th>
                      <th className="text-right py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.slice(0, 50).map(u => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary/50 grid place-items-center text-white text-xs font-bold shrink-0">
                              {(u.display_name?.[0] || "U").toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{u.display_name || "Unnamed"}</div>
                              <div className="text-xs text-muted-foreground">{u.id.slice(0, 10)}…</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className={
                            u.subscriptions?.plan === "business" ? "border-amber-500 text-amber-500" :
                            u.subscriptions?.plan === "pro" ? "border-primary text-primary" :
                            u.subscriptions?.plan === "starter" ? "border-blue-400 text-blue-400" : ""
                          }>
                            {u.subscriptions?.plan || "free"}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-medium">
                          {(wallets.get(u.id) ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 text-muted-foreground text-xs">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-green-500 border-green-500/30"
                              onClick={() => { setCreditModal({ user: u, mode: "add" }); setCreditAmount(""); setCreditReason(""); }}>
                              +Credits
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-red-500 border-red-500/30"
                              onClick={() => { setCreditModal({ user: u, mode: "remove" }); setCreditAmount(""); setCreditReason(""); }}>
                              -Credits
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2"
                              onClick={() => { setPlanModal(u); setNewPlan(u.subscriptions?.plan || "free"); }}>
                              Plan
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length > 50 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Showing 50 of {filteredUsers.length} users
                </p>
              )}
            </Card>
          </TabsContent>

          {/* ── PLANS ── */}
          <TabsContent value="plans">
            <p className="text-sm text-muted-foreground mb-4">
              Changes here reflect immediately on the public pricing page.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {plans.map(plan => (
                <Card key={plan.id} className="glass border-0 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-display text-xl font-semibold">{plan.display_name || plan.name}</h3>
                      <p className="text-xs text-muted-foreground">slug: {plan.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={plan.is_active ? "bg-green-500/20 text-green-400 border-green-500/30 border" : "bg-red-500/20 text-red-400 border-red-500/30 border"}>
                        {plan.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingPlan({
                          ...plan,
                          price_monthly_edit: Number(plan.price_monthly ?? 0),
                          price_yearly_edit: Number(plan.price_yearly ?? 0),
                        });
                        setPlanDialogOpen(true);
                      }}>
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-muted/30 p-3 text-center">
                      <div className="text-xs text-muted-foreground">Monthly</div>
                      <div className="font-bold">${Number(plan.price_monthly ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3 text-center">
                      <div className="text-xs text-muted-foreground">Yearly</div>
                      <div className="font-bold">${Number(plan.price_yearly ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3 text-center">
                      <div className="text-xs text-muted-foreground">Credits/mo</div>
                      <div className="font-bold">{plan.monthly_credits.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {((plan.features as string[]) || []).map((f, i) => (
                      <Badge key={i} variant="secondary" className="bg-muted/50 text-xs">{f}</Badge>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Plan: {editingPlan?.display_name || editingPlan?.name}</DialogTitle>
                </DialogHeader>
                {editingPlan && (
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label>Display Name</Label>
                      <Input value={editingPlan.display_name ?? ""} className="mt-1"
                        onChange={e => setEditingPlan({ ...editingPlan, display_name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Monthly Price ($)</Label>
                        <Input type="number" step="0.01" className="mt-1"
                          value={editingPlan.price_monthly_edit ?? 0}
                          onChange={e => setEditingPlan({ ...editingPlan, price_monthly_edit: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label>Yearly Price ($)</Label>
                        <Input type="number" step="0.01" className="mt-1"
                          value={editingPlan.price_yearly_edit ?? 0}
                          onChange={e => setEditingPlan({ ...editingPlan, price_yearly_edit: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div>
                      <Label>Monthly Credits</Label>
                      <Input type="number" className="mt-1"
                        value={editingPlan.monthly_credits}
                        onChange={e => setEditingPlan({ ...editingPlan, monthly_credits: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Features</Label>
                      <div className="mt-2 space-y-2">
                        {((editingPlan.features as string[]) || []).map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="flex-1 text-sm bg-muted/30 px-3 py-1.5 rounded-lg">{f}</span>
                            <Button variant="ghost" size="sm" className="size-7 p-0 text-destructive" onClick={() => removeFeature(i)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input placeholder="Add feature…" value={newFeature}
                            onChange={e => setNewFeature(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addFeature()} />
                          <Button variant="outline" size="sm" onClick={addFeature}>
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch id="planActive" checked={editingPlan.is_active}
                        onCheckedChange={v => setEditingPlan({ ...editingPlan, is_active: v })} />
                      <Label htmlFor="planActive" className="cursor-pointer">Active (visible on pricing page)</Label>
                    </div>
                  </div>
                )}
                <DialogFooter className="mt-4 gap-2">
                  <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
                  <Button className="btn-gradient text-white border-0" onClick={updatePlan}>Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ── CAMPAIGNS ── */}
          <TabsContent value="campaigns" className="space-y-6">
            <Card className="glass border-0 p-6">
              <h3 className="font-display font-semibold mb-4">Compose Email Campaign</h3>

              <div className="space-y-4">
                <div>
                  <Label>To</Label>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {(["all", "free", "paid", "specific"] as const).map(t => (
                      <Button key={t} variant={campaignTo === t ? "default" : "outline"} size="sm"
                        className={campaignTo === t ? "btn-gradient text-white border-0" : ""}
                        onClick={() => setCampaignTo(t)}>
                        {t === "all" ? "All Users" : t === "free" ? "Free Users" : t === "paid" ? "Paid Users" : "Specific Email"}
                      </Button>
                    ))}
                  </div>
                  {campaignTo === "specific" && (
                    <Input className="mt-2" placeholder="recipient@example.com"
                      value={specificEmail} onChange={e => setSpecificEmail(e.target.value)} />
                  )}
                </div>

                <div>
                  <Label>Templates</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {EMAIL_TEMPLATES.map(t => (
                      <Button key={t.name} variant="outline" size="sm" onClick={() => {
                        setCampaignSubject(t.subject);
                        setCampaignBody(t.body);
                      }}>
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Subject</Label>
                  <Input className="mt-1" placeholder="Email subject…"
                    value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} />
                </div>

                <div>
                  <Label>Body (HTML supported)</Label>
                  <Textarea className="mt-1 min-h-[200px] font-mono text-sm"
                    placeholder="<p>Your email content here...</p>"
                    value={campaignBody} onChange={e => setCampaignBody(e.target.value)} />
                </div>

                <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setPreviewOpen(true)}
                      disabled={!campaignBody.trim()}>
                      Preview
                    </Button>
                    <Button className="btn-gradient text-white border-0"
                      disabled={sending || !campaignSubject.trim() || !campaignBody.trim()}
                      onClick={sendCampaign}>
                      {sending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Sending…</> : <><Send className="size-4 mr-2" /> Send Campaign</>}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Recipients:{" "}
                    <span className="font-medium text-foreground">
                      {campaignTo === "all" ? `~${stats.users}` :
                       campaignTo === "paid" ? `~${stats.paid}` :
                       campaignTo === "free" ? `~${stats.users - stats.paid}` :
                       specificEmail || "—"}
                    </span>
                  </p>
                </div>
              </div>
            </Card>

            <Card className="glass border-0 p-6">
              <h3 className="font-display font-semibold mb-4">Sent Campaigns</h3>
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No campaigns sent yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium text-muted-foreground">Subject</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Recipients</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Sent</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map(c => (
                        <tr key={c.id} className="border-b border-border/50">
                          <td className="py-2.5 max-w-[200px] truncate">{c.subject}</td>
                          <td className="py-2.5">
                            <Badge variant="outline" className="capitalize text-xs">{c.recipient_type}</Badge>
                            <span className="ml-2 text-muted-foreground">{c.recipient_count}</span>
                          </td>
                          <td className="py-2.5 text-right text-muted-foreground text-xs">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 text-right">
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border text-xs">
                              {c.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ── SETTINGS ── */}
          <TabsContent value="settings">
            <Card className="glass border-0 p-6 max-w-2xl">
              <h3 className="font-display font-semibold mb-6 flex items-center gap-2">
                <Globe className="size-5" /> Site Settings
              </h3>
              <div className="space-y-5">
                <div>
                  <Label>Site Name</Label>
                  <Input className="mt-1" value={siteSettings.site_name}
                    onChange={e => setSiteSettings({ ...siteSettings, site_name: e.target.value })} />
                </div>
                <div>
                  <Label>Support Email</Label>
                  <Input className="mt-1" type="email" value={siteSettings.support_email}
                    onChange={e => setSiteSettings({ ...siteSettings, support_email: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Free Signup Credits</Label>
                    <Input className="mt-1" type="number"
                      value={siteSettings.free_signup_credits}
                      onChange={e => setSiteSettings({ ...siteSettings, free_signup_credits: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Max Images/Day</Label>
                    <Input className="mt-1" type="number"
                      value={siteSettings.max_images_per_day}
                      onChange={e => setSiteSettings({ ...siteSettings, max_images_per_day: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Max Videos/Day</Label>
                    <Input className="mt-1" type="number"
                      value={siteSettings.max_videos_per_day}
                      onChange={e => setSiteSettings({ ...siteSettings, max_videos_per_day: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border">
                  <Switch id="maintenanceMode" checked={siteSettings.maintenance_mode}
                    onCheckedChange={v => setSiteSettings({ ...siteSettings, maintenance_mode: v })} />
                  <div>
                    <Label htmlFor="maintenanceMode" className="cursor-pointer font-medium">Maintenance Mode</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Shows a maintenance banner to all non-admin users</p>
                  </div>
                </div>
                <Button className="btn-gradient text-white border-0 w-full" onClick={saveSiteSettings} disabled={savingSettings}>
                  {savingSettings ? <><Loader2 className="size-4 mr-2 animate-spin" /> Saving…</> : "Save Settings"}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Credit Modal */}
      <Dialog open={!!creditModal} onOpenChange={open => !open && setCreditModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {creditModal?.mode === "add" ? "Add Credits" : "Remove Credits"} — {creditModal?.user.display_name || "User"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Amount</Label>
              <Input type="number" className="mt-1" placeholder="e.g. 100"
                value={creditAmount} onChange={e => setCreditAmount(e.target.value)} />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input className="mt-1" placeholder="e.g. Promotional grant"
                value={creditReason} onChange={e => setCreditReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setCreditModal(null)}>Cancel</Button>
            <Button className={creditModal?.mode === "add" ? "btn-gradient text-white border-0" : "bg-destructive text-white hover:bg-destructive/90"}
              onClick={handleAddRemoveCredits}>
              {creditModal?.mode === "add" ? "Add Credits" : "Remove Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Modal */}
      <Dialog open={!!planModal} onOpenChange={open => !open && setPlanModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Plan — {planModal?.display_name || "User"}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Label>New Plan</Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter (Basic)</SelectItem>
                <SelectItem value="pro">Pro (Standard)</SelectItem>
                <SelectItem value="business">Business (Pro)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setPlanModal(null)}>Cancel</Button>
            <Button className="btn-gradient text-white border-0" onClick={handleChangePlan}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview — {campaignSubject || "No subject"}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 rounded-xl border border-border bg-white text-black p-6 prose max-w-none"
            dangerouslySetInnerHTML={{ __html: campaignBody }} />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
