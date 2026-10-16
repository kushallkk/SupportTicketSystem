import { GitMerge, Route, Sparkles, Wand2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  { icon: Wand2, title: "Auto-triage", text: "Category and priority predicted the moment a ticket arrives." },
  { icon: Route, title: "Smart routing", text: "The right, least-busy agent gets it. No round-robin guessing." },
  { icon: GitMerge, title: "Duplicate detection", text: "Spot repeat issues and reuse the fix that already worked." },
];

/** Split-screen frame shared by the sign-in and sign-up pages. */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="brand-gradient relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div aria-hidden className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 size-96 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Sparkles className="size-4.5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">ResolveIQ</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
              Support that sorts itself out.
            </h2>
            <p className="text-base text-white/75">
              An AI-powered help desk that reads, routes and remembers, so your team spends time fixing problems,
              not filing them.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-sm text-white/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/55">Embeddings, logistic regression and weighted routing. Free and open.</p>
      </aside>

      <main className="relative flex items-center justify-center bg-background p-6">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="brand-gradient flex size-10 items-center justify-center rounded-xl text-white shadow-lg shadow-primary/30 lg:hidden">
              <Sparkles className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
