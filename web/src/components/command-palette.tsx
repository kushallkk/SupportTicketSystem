"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { LayoutDashboard, Plus, Users, BarChart3, Sun, Moon, Ticket } from "lucide-react";
import { useTheme } from "next-themes";
import { PriorityBadge, StatusBadge } from "@/components/ticket-badges";
import type { TicketListItem } from "@/hooks/use-tickets";

type NavAction = { label: string; icon: React.ReactNode; href?: string; onSelect?: () => void };

const BASE_PATH = { USER: "/dashboard", AGENT: "/agent", ADMIN: "/admin" } as const;

export function CommandPalette({ role }: { role: "USER" | "AGENT" | "ADMIN" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Search tickets by title/description as you type (debounced). Only the roles' own visible tickets come back.
  const term = query.trim();
  useEffect(() => {
    if (!open || term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tickets?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (res.ok) setTickets((await res.json()).slice(0, 6));
      } catch {
        /* aborted or offline: keep whatever is already shown */
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, open]);

  const home = BASE_PATH[role];

  const actions: NavAction[] = [
    { label: "Go to dashboard", icon: <LayoutDashboard className="size-4" />, href: home },
    ...(role === "USER"
      ? [{ label: "Raise a new ticket", icon: <Plus className="size-4" />, href: "/dashboard/new" }]
      : []),
    ...(role === "ADMIN"
      ? [
          { label: "All tickets", icon: <Ticket className="size-4" />, href: "/admin" },
          { label: "Manage agents", icon: <Users className="size-4" />, href: "/admin/agents" },
          { label: "Analytics", icon: <BarChart3 className="size-4" />, href: "/admin/analytics" },
        ]
      : []),
    {
      label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      icon: resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />,
      onSelect: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
  ];

  function close() {
    setOpen(false);
    setQuery("");
    setTickets([]);
  }

  function run(action: NavAction) {
    close();
    if (action.href) router.push(action.href);
    action.onSelect?.();
  }

  const shownTickets = term.length >= 2 ? tickets : [];

  return (
    <CommandDialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <Command>
        <CommandInput placeholder="Type a command or search..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            {actions.map((action) => (
              <CommandItem key={action.label} onSelect={() => run(action)}>
                {action.icon}
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {shownTickets.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Tickets">
                {shownTickets.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`${term} ticket-${t.id} ${t.title}`}
                    onSelect={() => {
                      close();
                      router.push(`${home}/${t.id}`);
                    }}
                  >
                    <Ticket className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <StatusBadge status={t.status as never} />
                    <PriorityBadge priority={t.priority as never} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
