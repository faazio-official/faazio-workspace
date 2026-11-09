"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { acceptSubUserInvite, PortalError } from "@/lib/portal/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaazioWordmark } from "@/components/brand/FaazioWordmark";

function inviteErrorMessage(err: unknown): string {
  if (err instanceof PortalError) {
    if (err.code === "weak_password") {
      return "Use at least 12 characters and avoid common passwords.";
    }
    if (err.code === "email_in_use") {
      return "That email already has a portal login. Ask the shop owner for a new invite.";
    }
    if (err.code === "invite_invalid") {
      return "This invite link is invalid or has expired. Ask the shop owner to send a new one.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Could not accept the invite.";
}

export default function AcceptInvitePage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit() {
    setError(null);
    if (!token) {
      setError("This invite link is missing its token.");
      return;
    }
    if (password.length < 12) {
      setError("Use at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await acceptSubUserInvite(token, password);
      setDone(true);
    } catch (err) {
      setError(inviteErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-40 size-[420px] rounded-full border-[36px] border-primary/[0.06] sm:-right-24 sm:-top-32"
      />
      <div className="relative w-full max-w-[420px]">
        <div className="space-y-4 rounded-[28px] border border-border/60 bg-card p-6 shadow-lift sm:p-7">
          <div>
            <FaazioWordmark className="h-[22px] w-auto text-primary" />
            <h1 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight text-foreground">
              {done ? "You're all set" : "Join your team"}
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {done
                ? "Your account is active. Sign in with your email and the password you just set."
                : "Choose a password for your Faazio seller console account."}
            </p>
          </div>

          {done ? (
            <>
              <p className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12px] text-success">
                <CheckCircle2 className="size-4" /> Account activated
              </p>
              <Link href="/login">
                <Button className="w-full">
                  Go to sign in <ArrowRight className="size-4" />
                </Button>
              </Link>
            </>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 12 characters"
                    className="h-10 border-input/60 bg-background pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    className="h-10 border-input/60 bg-background pl-9"
                  />
                </div>
              </div>
              {token === "" ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  This invite link is invalid. Ask the shop owner to send a new one.
                </p>
              ) : null}
              {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy || !token}>
                {busy ? "Activating..." : "Set password & activate"}
                {busy ? null : <ArrowRight className="size-4" />}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-start justify-center gap-2 px-2 text-left text-[12px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <span>This link works once and expires after 7 days.</span>
        </p>
      </div>
    </div>
  );
}