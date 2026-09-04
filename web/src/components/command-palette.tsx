"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LayoutDashboard, Plus, Users, BarChart3, Sun, Moon, Ticket } from "lucide-react";
import { useTheme } from "next-themes";

type NavAction = { label: string; icon: React.ReactNode; href?: string; onSelect?: () => void };

export function CommandPalette({ role }: { role: "USER" | "AGENT" | "ADMIN" }) {
  const [open, setOpen] = useState(false);
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

  const home = role === "USER" ? "/dashboard" : role === "AGENT" ? "/agent" : "/admin";

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

  function run(action: NavAction) {
    setOpen(false);
    if (action.href) router.push(action.href);
    action.onSelect?.();
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
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
      </CommandList>
    </CommandDialog>
  );
}
