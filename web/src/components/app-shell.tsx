"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  BarChart3,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Ticket,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { initials } from "@/lib/ticket-display";

type Role = "USER" | "AGENT" | "ADMIN";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Extra paths that should keep this item highlighted (e.g. a ticket's detail page). */
  alsoActive?: RegExp;
};

type NavGroup = { label: string; items: NavItem[] };

const NAV: Record<Role, NavGroup[]> = {
  USER: [
    {
      label: "Support",
      items: [
        { label: "My tickets", href: "/dashboard", icon: <LayoutDashboard />, alsoActive: /^\/dashboard\/(?!new$)[^/]+$/ },
        { label: "Raise a ticket", href: "/dashboard/new", icon: <Plus /> },
      ],
    },
  ],
  AGENT: [
    {
      label: "Support",
      items: [{ label: "My queue", href: "/agent", icon: <LayoutDashboard />, alsoActive: /^\/agent\/[^/]+$/ }],
    },
  ],
  ADMIN: [
    {
      label: "Support",
      items: [
        { label: "All tickets", href: "/admin", icon: <Ticket />, alsoActive: /^\/admin\/(?!agents$|analytics$)[^/]+$/ },
      ],
    },
    {
      label: "Insights",
      items: [
        { label: "Agents", href: "/admin/agents", icon: <Users /> },
        { label: "Analytics", href: "/admin/analytics", icon: <BarChart3 /> },
      ],
    },
  ],
};

const ROLE_LABEL: Record<Role, string> = { USER: "Customer", AGENT: "Agent", ADMIN: "Admin" };

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="brand-gradient flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-primary/30">
        <Sparkles className="size-4" />
      </div>
      <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
        <span className="text-[15px] font-semibold tracking-tight">ResolveIQ</span>
        <span className="text-[11px] text-muted-foreground">AI support desk</span>
      </div>
    </div>
  );
}

function openCommandMenu() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}

function UserMenu({ role, userName }: { role: Role; userName: string }) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton size="lg" className="data-open:bg-sidebar-accent">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-medium text-primary">
                {initials(userName)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">{userName}</span>
              <span className="truncate text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium text-foreground">{userName}</span>
            <span className="block text-xs text-muted-foreground">{ROLE_LABEL[role]} account</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openCommandMenu}>
          <Search className="size-4" />
          Command menu
          <span className="ml-auto text-xs text-muted-foreground">⌘K</span>
        </DropdownMenuItem>
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
  );
}

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
  const groups = NAV[role];
  const current = groups.flatMap((g) => g.items).find((i) => pathname === i.href || i.alsoActive?.test(pathname));

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="pt-3">
          <Logo />
        </SidebarHeader>

        <SidebarContent>
          {role === "USER" && (
            <SidebarGroup className="pb-0">
              <SidebarGroupContent>
                <Button
                  render={<Link href="/dashboard/new" />}
                  className="w-full justify-start gap-2 shadow-md shadow-primary/20 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                >
                  <Plus className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">New ticket</span>
                </Button>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = pathname === item.href || !!item.alsoActive?.test(pathname);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.label}
                          render={<Link href={item.href} />}
                          className="data-active:shadow-sm"
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Command menu (⌘K)" onClick={openCommandMenu} className="text-muted-foreground">
                <Search />
                <span>Search &amp; commands</span>
                <kbd className="ml-auto rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-foreground/5">
                  ⌘K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <UserMenu role={role} userName={userName} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="h-svh min-w-0 overflow-hidden md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:shadow-[var(--shadow-soft)]">
        <header className="flex h-14 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <Separator orientation="vertical" className="mx-1 data-vertical:h-4" />
          <p className="truncate text-sm font-medium text-muted-foreground">
            {current?.label ?? "Ticket"}
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={openCommandMenu}
              className="hidden h-8 gap-2 rounded-lg bg-muted/60 px-3 text-muted-foreground hover:bg-muted sm:flex"
            >
              <Search className="size-3.5" />
              <span className="text-xs">Search or jump to...</span>
              <kbd className="ml-4 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-foreground/5">⌘K</kbd>
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </SidebarInset>

      <CommandPalette role={role} />
    </SidebarProvider>
  );
}
