"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import type { Role } from "@/data/types";
import { useSession, useSessionStatus } from "@/lib/hooks/useSession";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OfflineState } from "@/components/patterns/OfflineState";
import { homeFor, ROLE_LABEL } from "@/lib/auth/permissions";
import { restoreSession, signOut } from "@/lib/api";
import {
  isBlockedInNativeSellerApp,
  isNativeSellerApp,
  isSellerScopedPath,
} from "@/lib/appContext";

export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const hydrated = useHydrated();
  const session = useSession();
  const status = useSessionStatus();
  const router = useRouter();
  const pathname = usePathname();
  const [retrying, setRetrying] = useState(false);
  const nativeSeller = hydrated && isNativeSellerApp();
  const blockedRole = nativeSeller && isBlockedInNativeSellerApp(session?.role);

  // An admin session must never persist inside the seller app: clear the HttpOnly cookies so the
  // next load returns to the seller sign-in instead of looping on a blocked admin route.
  useEffect(() => {
    if (blockedRole) void signOut();
  }, [blockedRole]);

  if (!hydrated) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (blockedRole) {
    return (
      <Denied
        title="Not available in the Faazio Seller app"
        body="This app is for sellers. Sign in with a seller account to continue."
        action={
          <Button asChild size="sm">
            <Link href="/login">Sign in as seller</Link>
          </Button>
        }
      />
    );
  }

  // The native Seller app is seller-scoped: a deep link to an admin console inside its WebView
  // gets a branded block instead of the admin shell. (The gateway JWT is the real boundary.)
  if (nativeSeller && !isSellerScopedPath(pathname)) {
    return (
      <Denied
        title="Not available in the Faazio Seller app"
        body="This section is limited to seller tools. Head back to your seller dashboard to keep working."
        action={
          <Button asChild size="sm">
            <Link href="/seller">Go to seller dashboard</Link>
          </Button>
        }
      />
    );
  }

  if (status === "reconnecting") {
    return (
      <OfflineState
        title="Reconnecting..."
        message="The gateway was briefly unreachable. We're retrying silently — your session will return without signing you out."
        busy={retrying}
        onRetry={() => {
          setRetrying(true);
          void restoreSession().finally(() => setRetrying(false));
        }}
      />
    );
  }

  if (!session) {
    return (
      <Denied
        title="Sign in to continue"
        body="This workspace needs a partner or admin session."
        action={
          <Button asChild size="sm">
            <Link href="/login">Go to sign in</Link>
          </Button>
        }
      />
    );
  }

  if (!allow.includes(session.role)) {
    return (
      <Denied
        title="Not your workspace"
        body={`You are signed in as ${ROLE_LABEL[session.role]}. This area is limited to ${allow
          .map((r) => ROLE_LABEL[r])
          .join(", ")}.`}
        action={
          <Button size="sm" onClick={() => router.push(homeFor(session.role))}>
            Back to my dashboard
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}

function Denied({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface max-w-md p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Lock className="size-5" />
        </div>
        <h1 className="text-[16px] font-semibold">{title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{body}</p>
        <div className="mt-4 flex justify-center">{action}</div>
      </div>
    </div>
  );
}
