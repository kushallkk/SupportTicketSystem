import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sparkles, Zap, GitMerge, BarChart3 } from "lucide-react";

const roleHome: Record<string, string> = {
  USER: "/dashboard",
  AGENT: "/agent",
  ADMIN: "/admin",
};

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect(roleHome[session.user.role] ?? "/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          ResolveIQ
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button render={<Link href="/signup" />}>Get started</Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-20 text-center">
        <div className="max-w-2xl space-y-5">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Support tickets that <span className="text-primary">route themselves.</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            ResolveIQ classifies, prioritizes, and assigns every ticket the moment it lands — then flags
            duplicates before your agents waste a minute on them.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button size="lg" render={<Link href="/signup" />}>
              Raise a ticket
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/login" />}>
              I have an account
            </Button>
          </div>
        </div>

        <div className="grid max-w-4xl gap-4 pt-8 sm:grid-cols-3">
          <FeatureCard
            icon={<Zap className="size-5" />}
            title="Auto-classification"
            description="ML predicts category, priority, and the best-fit agent on every new ticket."
          />
          <FeatureCard
            icon={<GitMerge className="size-5" />}
            title="Duplicate detection"
            description="Embeddings catch near-identical tickets and surface the resolved fix instantly."
          />
          <FeatureCard
            icon={<BarChart3 className="size-5" />}
            title="Smart load-balancing"
            description="Assignment scoring weighs workload and category track record — not round robin."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 text-left shadow-sm">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
