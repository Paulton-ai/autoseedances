import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles, Zap, Layers, Workflow, ShieldCheck, Download, Chrome,
  Play, ArrowRight, Check, Cpu, Bot, Clock,
} from "lucide-react";

export const CHROME_STORE_URL = "https://chromewebstore.google.com/"; // TODO: replace with real listing URL
export const EDGE_STORE_URL = "https://microsoftedge.microsoft.com/addons/"; // TODO: replace with real listing URL

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Auto Seedance — Bulk AI Images & Videos Generator Automation" },
      { name: "description", content: "The bridge between you and your AI tools. Queue hundreds of prompts, automate Dreamina image & video generation, and streamline bulk AI creation directly in your browser." },
      { property: "og:title", content: "Auto Seedance — Bulk AI Images & Videos Generator Automation" },
      { property: "og:description", content: "Queue hundreds of prompts, automate Dreamina image & video generation, and streamline bulk AI creation directly in your browser." },
      { property: "og:url", content: "https://vizio-automata.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://vizio-automata.lovable.app/" }],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <LogosStrip />
      <DemoSection />
      <Features />
      <HowItWorks />
      <ExtensionSection />
      <PricingTeaser />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative pt-40 pb-28 grid-bg overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge variant="outline" className="border-border bg-muted/50 backdrop-blur text-xs">
            <Sparkles className="size-3 mr-1 text-primary" /> Chrome &amp; Edge Extension · Free during Early Access
          </Badge>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-6 font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]"
        >
          The bridge between you
          <br />
          <span className="gradient-text">and your AI tools.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
        >
          Queue hundreds of prompts, automate generation workflows, and streamline AI image &amp; video creation directly inside your browser.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-9 flex flex-wrap justify-center gap-3"
        >
          <Link to="/extension">
            <Button size="lg" className="btn-gradient text-white border-0 h-12 px-6 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition">
              <Download className="mr-2 size-4" /> Install Extension
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button size="lg" variant="outline" className="h-12 px-6 border-border bg-muted/50 backdrop-blur hover:bg-muted transition">
              Open Dashboard <ArrowRight className="ml-1 size-4" />
            </Button>
          </Link>
        </motion.div>
        <p className="mt-4 text-xs text-muted-foreground">Supports Chrome, Edge, Brave, Arc, and Opera.</p>
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 mx-auto max-w-5xl"
        >
          <div className="glass rounded-2xl p-2 glow-purple">
            <div className="rounded-xl bg-[oklch(0.13_0.03_270)] aspect-[16/9] grid place-items-center relative overflow-hidden">
              <div className="absolute inset-0 grid-bg opacity-60" />
              <div className="relative text-center">
                <div className="size-16 rounded-full btn-gradient grid place-items-center mx-auto glow-purple">
                  <Play className="size-7 text-white ml-1" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Bulk automation, running in your browser</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function LogosStrip() {
  const items = ["Dreamina", "Chrome", "Edge", "Brave", "Arc", "Opera"];
  return (
    <div className="border-y border-border py-8">
      <div className="mx-auto max-w-6xl px-4 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-muted-foreground/80">
        <span className="text-xs uppercase tracking-widest">Works with</span>
        {items.map((i) => (
          <span key={i} className="font-display font-semibold text-base opacity-70">{i}</span>
        ))}
      </div>
    </div>
  );
}

function DemoSection() {
  return (
    <section className="py-28">
      <div className="mx-auto max-w-6xl px-4 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <Badge variant="outline" className="border-border bg-muted/50">Automation</Badge>
          <h2 className="mt-4 font-display text-4xl font-bold">Your prompts → our queue → real results.</h2>
          <p className="mt-4 text-muted-foreground">
            Drop a list of prompts, hit run. Our browser extension takes over, drives Dreamina with your account, and streams finished images and videos back to your dashboard.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Bulk paste hundreds of prompts at once",
              "Smart retries, throttling, anti-rate-limit",
              "Auto-download &amp; organized library",
              "Realtime queue progress in your dashboard",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 size-5 rounded-md btn-gradient grid place-items-center">
                  <Check className="size-3 text-white" />
                </span>
                <span dangerouslySetInnerHTML={{ __html: t }} />
              </li>
            ))}
          </ul>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
        >
          <Card className="glass border-0 p-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Queue · 124 jobs</span>
              <span className="text-green-400">● Running</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { p: "Cinematic drone shot of Tokyo at dusk, neon", s: 100 },
                { p: "Macro shot of glowing crystal forming, slow", s: 72 },
                { p: "Astronaut floating through neon nebula 4k", s: 41 },
                { p: "Liquid metal morphing into a rose, studio", s: 0 },
              ].map((j, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/40 p-3">
                  <div className="text-xs truncate">{j.p}</div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div className="h-full btn-gradient" style={{ width: `${j.s}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Workflow, title: "Bulk prompt queue", desc: "Paste hundreds of prompts and let the queue grind through them, 24/7." },
    { icon: Bot, title: "Browser automation", desc: "Our extension drives Dreamina with your own logged-in account." },
    { icon: Download, title: "Auto download library", desc: "Every output is saved, tagged, and previewable in your dashboard." },
    { icon: Zap, title: "Fast & throttled", desc: "Smart pacing avoids rate limits while keeping throughput high." },
    { icon: ShieldCheck, title: "Credentials stay local", desc: "Your AI account credentials never leave your browser." },
    { icon: Cpu, title: "Built for creators", desc: "AI creator productivity tools for image and video workflows at scale." },
  ];
  return (
    <section id="features" className="py-24 border-t border-border">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="outline" className="border-border bg-muted/50">Features</Badge>
          <h2 className="mt-4 font-display text-4xl font-bold">Everything a bulk AI creator needs.</h2>
          <p className="mt-3 text-muted-foreground">A premium automation layer for the AI image and video tools you already use.</p>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {items.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Card className="glass border-0 p-6 h-full hover:translate-y-[-2px] hover:shadow-lg hover:shadow-purple-500/10 transition">
                <div className="size-10 rounded-xl btn-gradient grid place-items-center">
                  <f.icon className="size-5 text-white" />
                </div>
                <h3 className="mt-4 font-display font-semibold text-lg">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Install the extension", d: "One-click install for Chrome and Microsoft Edge." },
    { n: "02", t: "Sign in to Dreamina", d: "Use your existing Dreamina account normally." },
    { n: "03", t: "Open Auto Seedance", d: "Connect your workflow dashboard instantly." },
    { n: "04", t: "Run your queue", d: "Queue prompts and automate generation workflows." },
  ];
  return (
    <section id="how" className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="outline" className="border-border bg-muted/50">How it works</Badge>
          <h2 className="mt-4 font-display text-4xl font-bold">From prompt to library in 4 steps.</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-4 gap-5">
          {steps.map((s) => (
            <Card key={s.n} className="glass border-0 p-6">
              <div className="text-xs gradient-text font-display font-bold">{s.n}</div>
              <div className="mt-2 font-semibold">{s.t}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExtensionSection() {
  return (
    <section className="py-24 border-t border-border">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="outline" className="border-border bg-muted/50"><Chrome className="size-3 mr-1" /> Browser extension</Badge>
          <h2 className="mt-4 font-display text-4xl font-bold">Available for Chrome and Microsoft Edge.</h2>
          <p className="mt-3 text-muted-foreground">Install in one click and start automating bulk AI generation today.</p>
        </div>
        <div className="mt-10 grid md:grid-cols-2 gap-4">
          <Card className="glass border-0 p-6">
            <div className="flex items-center gap-3">
              <Chrome className="size-7 text-blue-400" />
              <div>
                <div className="font-display font-semibold">Chrome Web Store</div>
                <div className="text-xs text-muted-foreground">Chrome · Brave · Arc · Opera</div>
              </div>
            </div>
            <Link to="/extension" className="block mt-5">
              <Button className="w-full btn-gradient text-white border-0">
                <Download className="size-4 mr-2" /> Install for Chrome
              </Button>
            </Link>
          </Card>
          <Card className="glass border-0 p-6">
            <div className="flex items-center gap-3">
              <Chrome className="size-7 text-cyan-400" />
              <div>
                <div className="font-display font-semibold">Microsoft Edge Add-ons</div>
                <div className="text-xs text-muted-foreground">Microsoft Edge</div>
              </div>
            </div>
            <Link to="/extension" className="block mt-5">
              <Button className="w-full btn-gradient text-white border-0">
                <Download className="size-4 mr-2" /> Install for Microsoft Edge
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </section>
  );
}


function PricingTeaser() {
  const features = [
    "Unlimited local workflow automation",
    "Bulk prompt queueing",
    "Browser-based automation",
    "AI creator productivity tools",
  ];
  return (
    <section id="pricing" className="py-24 border-t border-border">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <Badge variant="outline" className="border-border bg-muted/50">Pricing</Badge>
        <h2 className="mt-4 font-display text-4xl font-bold">Currently Free During Early Access</h2>
        <p className="mt-3 text-muted-foreground">No credit card. No paid tiers. Just install and automate.</p>
        <Card className="glass border-0 p-8 mt-10 glow-purple text-left">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-display font-semibold text-xl">Auto Seedance — Free</h3>
              <p className="text-sm text-muted-foreground mt-1">Everything you need to automate bulk AI generation.</p>
            </div>
            <Badge className="btn-gradient text-white border-0">Early Access</Badge>
          </div>
          <ul className="mt-6 grid sm:grid-cols-2 gap-2 text-sm">
            {features.map((f) => (
              <li key={f} className="flex gap-2"><Check className="size-4 text-primary shrink-0 mt-0.5" />{f}</li>
            ))}
          </ul>
          <Link to="/extension" className="block mt-7">
            <Button size="lg" className="w-full btn-gradient text-white border-0">
              Start Free <ArrowRight className="ml-1 size-4" />
            </Button>
          </Link>
        </Card>
      </div>
    </section>
  );
}

// Kept for backwards-compat with /pricing route legacy import.
export const plans: Array<{
  name: string; price: string; suffix: string; badge: string | null; featured: boolean; features: string[]; cta: string;
}> = [];

function FAQ() {
  const faqs = [
    { q: "What is Auto Seedance?", a: "Auto Seedance is a browser extension and dashboard that automates bulk AI image and video generation on Dreamina. Queue hundreds of prompts and let the extension drive your account on autopilot." },
    { q: "Is Auto Seedance free?", a: "Yes. During Early Access, Auto Seedance is 100% free with unlimited local workflow automation, bulk queueing, and browser-based automation." },
    { q: "Are my Dreamina credentials safe?", a: "Yes. The extension runs locally in your browser. We never see or store your Dreamina passwords — automation happens inside your own logged-in session." },
    { q: "Which browsers are supported?", a: "Chrome, Microsoft Edge, Brave, Arc, and Opera — any Chromium-based browser." },
    { q: "Can I queue both images and videos?", a: "Yes. Auto Seedance supports bulk AI image and video generation workflows on Dreamina." },
  ];
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <Badge variant="outline" className="border-border bg-muted/50">FAQ</Badge>
          <h2 className="mt-4 font-display text-4xl font-bold">Questions, answered.</h2>
        </div>
        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q} className="border-border">
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4">
        <div className="glass rounded-3xl p-12 text-center grid-bg">
          <Layers className="size-10 mx-auto text-primary" />
          <h2 className="mt-4 font-display text-4xl font-bold">Stop babysitting prompts.</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Let Auto Seedance run the queue while you focus on the next idea.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/extension"><Button size="lg" className="btn-gradient text-white border-0 h-12 px-6"><Download className="size-4 mr-2" /> Install Extension</Button></Link>
            <Link to="/dashboard"><Button size="lg" variant="outline" className="h-12 px-6 border-border bg-muted/50"><Clock className="mr-2 size-4" /> Open Dashboard</Button></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
