"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider delay={150}>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
