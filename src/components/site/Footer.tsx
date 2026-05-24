import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border mt-32">
      <div className="mx-auto max-w-7xl px-4 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="size-8 rounded-lg btn-gradient grid place-items-center">
              <Sparkles className="size-4 text-white" />
            </span>
            <span className="gradient-text">Auto Seedance</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">
            Bulk AI Images &amp; Videos Generator Automation. Automate Dreamina image &amp; video generation workflows directly from your browser.
          </p>
        </div>
        <div className="text-sm">
          <h4 className="font-semibold mb-3">Product</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/extension" className="hover:text-foreground">Extension</Link></li>
            <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
            <li><a href="/#features" className="hover:text-foreground">Features</a></li>
            <li><a href="/#faq" className="hover:text-foreground">FAQ</a></li>
          </ul>
        </div>
        <div className="text-sm">
          <h4 className="font-semibold mb-3">Account</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/auth" className="hover:text-foreground">Sign in</Link></li>
            <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <h4 className="font-semibold mb-3">Legal</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-foreground">Terms of Service</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground">
            AI Model Infrastructure Partners
          </h4>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Auto Seedance automates workflows on top of leading third-party AI
            generation platforms. We are not affiliated with these providers;
            references are listed for transparency.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <a
                href="https://dreamina.capcut.com/"
                target="_blank"
                rel="nofollow noopener noreferrer external"
                className="text-muted-foreground hover:text-foreground"
              >
                Dreamina by CapCut
              </a>
            </li>
            <li>
              <a
                href="https://www.byteplus.com/en/solutions/seedance"
                target="_blank"
                rel="nofollow noopener noreferrer external"
                className="text-muted-foreground hover:text-foreground"
              >
                BytePlus Seedance 2.0
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Auto Seedance. Bulk AI automation for creators.
      </div>
    </footer>
  );
}
