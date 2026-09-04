import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <AppShell role="ADMIN" userName={session!.user.name}>
      {children}
    </AppShell>
  );
}
