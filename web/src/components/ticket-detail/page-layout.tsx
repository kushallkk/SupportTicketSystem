import { Skeleton } from "@/components/ui/skeleton";

/**
 * Ticket page in the 3-column viewport: (sidebar from AppShell) | conversation | contextual panel.
 * On screens narrower than `xl` the panel drops below the conversation and the page scrolls as one.
 */
export function TicketPageLayout({
  main,
  aside,
  asideLabel = "Ticket details",
}: {
  main: React.ReactNode;
  aside: React.ReactNode;
  asideLabel?: string;
}) {
  return (
    <div className="scrollbar-thin flex h-full min-h-0 flex-col overflow-y-auto xl:flex-row xl:overflow-hidden">
      <div className="scrollbar-thin min-w-0 flex-1 xl:overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 pt-1 pb-10 sm:px-6">{main}</div>
      </div>
      <aside
        aria-label={asideLabel}
        className="scrollbar-thin mx-2 mb-2 shrink-0 rounded-2xl bg-muted/40 xl:mx-0 xl:mr-2 xl:w-[24rem] xl:overflow-y-auto 2xl:w-[26rem]"
      >
        <div className="space-y-4 p-5">{aside}</div>
      </aside>
    </div>
  );
}

export function TicketPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col xl:flex-row">
      <div className="min-w-0 flex-1 space-y-4 px-4 pt-1 sm:px-6">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
      <div className="mx-2 mb-2 space-y-4 rounded-2xl bg-muted/40 p-5 xl:mx-0 xl:mr-2 xl:w-[24rem]">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function TicketNotFound() {
  return <p className="px-4 text-sm text-muted-foreground sm:px-6">Ticket not found.</p>;
}
