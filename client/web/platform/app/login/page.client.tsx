"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signIn } from "@/lib/api";
import { hydrateFromGateway } from "@/lib/api/sync";
import { fetchPortalStatus, portalErrorMessage, type PortalStatus } from "@/lib/portal/auth";
import { homeFor, ROLE_LABEL } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandTile } from "@/components/brand/FaazioMark";

function diagnosticCopy(status: PortalStatus): string | null {
  if (!status.portalEnabled) {
    return "This portal build has no gateway URL — rebuild/redeploy with NEXT_PUBLIC_GATEWAY_URL.";
  }
  if (!status.gatewayReachable) {
    return `Gateway unreachable (${status.gatewayBaseHost || "unknown host"}) — check the gateway and retry.`;
  }
  if (status.gatewayAuth === "portal_auth_unavailable") {
    return "Gateway auth is not configured — set PORTAL_JWT_SECRET on Render, then retry.";
  }
  return null;
}

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchPortalStatus().then((status) => {
      if (active && status) setDiagnostic(diagnosticCopy(status));
    });
    return () => {
      active = false;
    };
  }, []);

  async function submit(nextEmail: string, nextPassword: string) {
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(nextEmail, nextPassword);
      if (user.mustChange && user.role !== "SUPER_ADMIN") {
        toast.success("Signed in — change your temporary password to continue.");
        router.push("/security");
        return;
      }
      await hydrateFromGateway();
      toast.success(`Signed in as ${ROLE_LABEL[user.role]}`);
      router.push(homeFor(user.role));
    } catch (err) {
      setError(portalErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2">
          <BrandTile className="size-8 rounded-md" />
          <div>
            <p className="text-[15px] font-semibold">Faazio Partner Portal</p>
            <p className="text-[12px] text-muted-foreground">Seller and admin sign-in</p>
          </div>
        </div>

        <form
          className="surface space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(email, password);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@faazio.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>
          {diagnostic ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
              {diagnostic}
            </p>
          ) : null}
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-[12px] text-muted-foreground">
          Access is issued by a Faazio superadmin. Ask them to reset your password if you are
          locked out.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
