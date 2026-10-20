"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DEMO_ACCOUNTS, signIn } from "@/lib/api";
import { hydrateFromGateway } from "@/lib/api/sync";
import { authMocked, authPortal } from "@/lib/config";
import { homeFor, ROLE_LABEL } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stateName } from "@/data/states";
import { BrandTile } from "@/components/brand/FaazioMark";


function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(nextEmail: string, nextPassword: string) {
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(nextEmail, nextPassword);
      if (user.mustChange) {
        toast.success("Signed in — change your initial password to continue.");
        router.push("/admin/super/security");
        return;
      }
      await hydrateFromGateway();
      toast.success(`Signed in as ${ROLE_LABEL[user.role]}`);
      router.push(homeFor(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
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
            <p className="text-[12px] text-muted-foreground">
              {authPortal() ? "Superadmin sign-in" : "Seller and admin sign-in"}
            </p>
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
              placeholder={authPortal() ? "you@faazio.com" : "seller@faazio.dev"}
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
              placeholder={authPortal() ? "Your password" : "demo1234"}
            />
          </div>
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {authPortal() && (
          <p className="mt-4 text-[12px] text-muted-foreground">
            Superadmin only. Seller and state-admin password sign-in is not available in this
            deployment.
          </p>
        )}

        {authMocked() && (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold text-muted-foreground">
              Demo accounts — mocked auth (set NEXT_PUBLIC_AUTH_MODE=supabase for GoTrue)
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-[12px] transition-colors hover:border-interactive hover:text-interactive"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    void submit(account.email, account.password);
                  }}
                >
                  <span className="font-semibold">{ROLE_LABEL[account.role]}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {account.stateCode ? stateName(account.stateCode) : "All states"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
