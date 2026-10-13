"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DEMO_ACCOUNTS, signIn } from "@/lib/api";
import { homeFor, ROLE_LABEL } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stateName } from "@/data/states";


function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(nextEmail: string, nextPassword: string) {
    const user = signIn(nextEmail, nextPassword);
    if (!user) {
      setError("That email and password pair is not in the demo directory.");
      return;
    }
    setError(null);
    toast.success(`Signed in as ${ROLE_LABEL[user.role]}`);
    router.push(homeFor(user.role));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-[14px] font-bold text-primary-foreground">
            F
          </div>
          <div>
            <p className="text-[15px] font-semibold">Faazio Partner Portal</p>
            <p className="text-[12px] text-muted-foreground">Seller and admin sign-in</p>
          </div>
        </div>

        <form
          className="surface space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit(email, password);
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
              placeholder="seller@faazio.dev"
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
              placeholder="demo1234"
            />
          </div>
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <div className="mt-4">
          <p className="mb-2 text-[12px] font-semibold text-muted-foreground">
            Demo accounts — one click fills and signs in
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
                  submit(account.email, account.password);
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
      </div>
    </div>
  );
}

export default LoginPage;
