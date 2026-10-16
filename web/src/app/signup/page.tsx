"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthShell } from "@/components/auth-shell";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "AGENT">("USER");
  const [agentCode, setAgentCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, agentCode: role === "AGENT" ? agentCode : undefined }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (signInRes?.error) {
      toast.success("Account created — please sign in");
      router.push("/login");
      return;
    }

    toast.success("Account created");
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell title="Create your account" description="Get started with ResolveIQ in under a minute.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-2">
          <Label>I am a...</Label>
          <Select
            items={[
              { value: "USER", label: "Customer raising tickets" },
              { value: "AGENT", label: "Support agent" },
            ]}
            value={role}
            onValueChange={(v) => setRole(v as "USER" | "AGENT")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">Customer raising tickets</SelectItem>
              <SelectItem value="AGENT">Support agent</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Admin accounts are provisioned separately by an existing admin.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          Create account
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
