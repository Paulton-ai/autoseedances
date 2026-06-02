import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { BlogTicker } from "@/components/blog/BlogTicker";
import { PostCard } from "@/components/blog/PostCard";
import { getAllPosts, getTrendingPosts } from "@/lib/posts";
import { AdSlot } from "@/components/blog/AdSlot";

const SITE_URL = "https://vizio-automata.lovable.app";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Auto Seedance | AI Automation Tutorials & Guides" },
      {
        name: "description",
        content:
          "Tutorials, prompt guides, tool reviews, and case studies for AI image and video automation with Auto Seedance.",
      },
      { property: "og:title", content: "Auto Seedance Blog" },
      { property: "og:description", content: "Tutorials, prompt guides, and tool reviews for AI automation." },
      { property: "og:url", content: `${SITE_URL}/blog` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/blog` }],
  }),
  component: BlogIndex,
});

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight border-l-4 border-primary pl-4 mb-8">
      {children}
    </h2>
  );
}

function BlogIndex() {
  const posts = getAllPosts();
  const trending = getTrendingPosts(6);
  const topRated = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-28">
        <section className="mx-auto max-w-7xl px-4 mb-10">
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            The <span className="gradient-text">Auto Seedance</span> Blog
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Tutorials, prompt guides, and case studies for bulk AI image and video generation.
          </p>
        </section>

        <BlogTicker posts={trending} />

        <section className="mx-auto max-w-7xl px-4 mt-12">
          <AdSlot format="leaderboard" />
        </section>

        {topRated.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 mt-16">
            <SectionHeading>Top Rated</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
              {topRated.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 mt-20 pb-24">
          <SectionHeading>Latest Posts</SectionHeading>
          {posts.length === 0 ? (
            <div className="text-center text-muted-foreground py-20">
              No posts yet. Add markdown files to <code>/content/posts/</code> or use the{" "}
              <Link to="/" className="text-primary underline">
                CMS
              </Link>
              .
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
