import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <AppShell role="AGENT" userName={session!.user.name}>
      {children}
    </AppShell>
  );
}
