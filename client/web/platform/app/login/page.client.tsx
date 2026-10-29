"use client";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { signIn, signOut } from "@/lib/api";
import { hydrateFromGateway } from "@/lib/api/sync";
import { fetchPortalStatus, portalErrorMessage, type PortalStatus } from "@/lib/portal/auth";
import { homeFor, ROLE_LABEL } from "@/lib/auth/permissions";
import { isBlockedInNativeSellerApp } from "@/lib/appContext";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useSession } from "@/lib/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OfflineState } from "@/components/patterns/OfflineState";
import { FaazioWordmark } from "@/components/brand/FaazioWordmark";

type DiagnosticCode = "not_configured" | "gateway_unreachable" | "portal_auth_unavailable";
interface Diagnostic {
  code: DiagnosticCode;
  message: string;
}

function diagnosticCopy(status: PortalStatus): Diagnostic | null {
  if (!status.portalEnabled) {
    return {
      code: "not_configured",
      message: "This portal build has no gateway URL — rebuild/redeploy with NEXT_PUBLIC_GATEWAY_URL.",
    };
  }
  if (!status.gatewayReachable) {
    return {
      code: "gateway_unreachable",
      message: `The gateway (${status.gatewayBaseHost || "unknown host"}) is unreachable. Check your connection and try again.`,
    };
  }
  if (status.gatewayAuth === "portal_auth_unavailable") {
    return {
      code: "portal_auth_unavailable",
      message: "Gateway auth is not configured — set PORTAL_JWT_SECRET on Render, then retry.",
    };
  }
  return null;
}

const NEXT_KEY = "faazio.next";

/** The seller app is seller-only. A rejected role sees the same copy as a bad password so the app
 *  never reveals that the credentials were valid-but-admin. */
const INVALID_CREDENTIALS = "Invalid email or password.";

/** Only allow an internal absolute path (guards /login?next= against open redirects). */
function safeNext(raw: string | null): string {
  if (!raw) return "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "";
}

/** The deep link a seller/admin attempted before being bounced to /login (query param, else a
 *  stashed hint from a forced password-rotation round-trip). Never a token — only a path. */
function initialNext(): string {
  if (typeof window === "undefined") return "";
  return safeNext(new URLSearchParams(window.location.search).get("next")) ||
    safeNext(window.sessionStorage.getItem(NEXT_KEY));
}

function LoginPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const submittedRef = useRef(false);

  const checkStatus = useCallback(async () => {
    setStatusBusy(true);
    try {
      const status = await fetchPortalStatus();
      setDiagnostic(status ? diagnosticCopy(status) : null);
    } finally {
      setStatusBusy(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  // Returning users (e.g. the seller app re-opening on /login with a live cookie) skip the form.
  useEffect(() => {
    if (!hydrated || submittedRef.current || !session) return;
    // A stale non-seller cookie inside the seller app (e.g. from before this guard shipped): clear
    // it and stay on the seller sign-in rather than bouncing to a blocked admin route.
    if (isBlockedInNativeSellerApp(session.role)) {
      submittedRef.current = true;
      void signOut().finally(() => {
        submittedRef.current = false;
        setError(INVALID_CREDENTIALS);
      });
      return;
    }
    const target =
      session.mustChange && session.role !== "SUPER_ADMIN"
        ? "/security"
        : initialNext() || homeFor(session.role);
    router.replace(target);
  }, [hydrated, session, router]);

  async function submit(nextEmail: string, nextPassword: string) {
    submittedRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(nextEmail, nextPassword, remember);
      // The seller app never accepts an admin session: sign straight back out (clears the HttpOnly
      // cookies) and show the generic bad-credentials copy — no role disclosure. The web portal is
      // unaffected (isBlockedInNativeSellerApp is false without `window.__faazio`).
      if (isBlockedInNativeSellerApp(user.role)) {
        await signOut();
        submittedRef.current = false;
        setError(INVALID_CREDENTIALS);
        return;
      }
      const next = initialNext();
      if (user.mustChange && user.role !== "SUPER_ADMIN") {
        // Temporary password: rotate at /security first, then finish the deep link on re-sign-in.
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(NEXT_KEY, next || homeFor(user.role));
        }
        toast.success("Signed in — change your temporary password to continue.");
        router.push("/security");
        return;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(NEXT_KEY);
      }
      await hydrateFromGateway();
      toast.success(`Signed in as ${ROLE_LABEL[user.role]}`);
      router.push(next || homeFor(user.role));
    } catch (err) {
      submittedRef.current = false;
      setError(portalErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (diagnostic?.code === "gateway_unreachable") {
    return (
      <OfflineState
        title="No internet connection"
        message={diagnostic.message}
        busy={statusBusy}
        onRetry={() => void checkStatus()}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="min-w-0">
            <FaazioWordmark className="h-[22px] w-auto text-primary" />
            <p className="mt-0.5 text-[12px] text-muted-foreground">Seller and admin sign-in</p>
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
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(value) => setRemember(value !== false && value !== "indeterminate")}
            />
            <Label htmlFor="remember" className="cursor-pointer text-[13px] font-normal text-muted-foreground">
              Stay signed in on this device
            </Label>
          </div>
          {diagnostic ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
              {diagnostic.message}
            </p>
          ) : null}
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
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

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
