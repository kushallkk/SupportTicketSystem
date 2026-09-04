"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Plus,
  Ticket,
  Users,
  BarChart3,
  Sparkles,
  LogOut,
  Command as CommandIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { initials } from "@/lib/ticket-display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Role = "USER" | "AGENT" | "ADMIN";

const NAV: Record<Role, { label: string; href: string; icon: React.ReactNode }[]> = {
  USER: [
    { label: "My tickets", href: "/dashboard", icon: <LayoutDashboard className="size-4" /> },
    { label: "Raise a ticket", href: "/dashboard/new", icon: <Plus className="size-4" /> },
  ],
  AGENT: [{ label: "My queue", href: "/agent", icon: <LayoutDashboard className="size-4" /> }],
  ADMIN: [
    { label: "All tickets", href: "/admin", icon: <Ticket className="size-4" /> },
    { label: "Agents", href: "/admin/agents", icon: <Users className="size-4" /> },
    { label: "Analytics", href: "/admin/analytics", icon: <BarChart3 className="size-4" /> },
  ],
};

export function AppShell({
  role,
  userName,
  children,
}: {
  role: Role;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV[role];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground sm:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-3.5" />
          </div>
          ResolveIQ
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          >
            <CommandIcon className="size-3.5" />
            Command menu
            <span className="ml-auto text-xs opacity-60">⌘K</span>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 font-semibold sm:hidden">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-3.5" />
            </div>
            ResolveIQ
          </div>
          <div className="hidden sm:block" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">{initials(userName)}</AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm sm:inline">{userName}</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>{role.charAt(0) + role.slice(1).toLowerCase()}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    await signOut({ redirect: false });
                    router.push("/login");
                    router.refresh();
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>

      <CommandPalette role={role} />
    </div>
  );
}
