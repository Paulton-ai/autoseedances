import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Image as ImageIcon, Video } from "lucide-react";
import { motion } from "framer-motion";


export function Navbar() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 inset-x-0 z-50"
    >
      <div className="mx-auto max-w-7xl px-4 mt-4">
        <div className="glass rounded-2xl px-5 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg shrink-0">
            <span className="size-8 rounded-lg btn-gradient grid place-items-center">
              <Sparkles className="size-4 text-white" />
            </span>
            <span className="gradient-text">Auto Seedance</span>
            <span className="hidden sm:inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground uppercase tracking-wider ml-1">
              Chrome &amp; Edge
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="/#features" className="hover:text-foreground transition">Features</a>
            <a href="/#how" className="hover:text-foreground transition">How it works</a>
            <Link to="/pricing" className="hover:text-foreground transition">Pricing</Link>
            <Link to="/tools/image" className="hover:text-foreground transition flex items-center gap-1.5">
              <ImageIcon className="size-3.5" /> Image Generation
            </Link>
            <Link to="/tools/video" className="hover:text-foreground transition flex items-center gap-1.5">
              <Video className="size-3.5" /> Video Generation
            </Link>
            <Link to="/blog" className="hover:text-foreground transition">Blog</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden sm:block"
            >
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>

          </div>
        </div>
      </div>
    </motion.header>
  );
}
