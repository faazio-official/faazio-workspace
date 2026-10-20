"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, RefreshCw } from "lucide-react";
import type { Role } from "@/data/types";
import { useSession, useSessionStatus } from "@/lib/hooks/useSession";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { homeFor, ROLE_LABEL } from "@/lib/auth/permissions";

export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const hydrated = useHydrated();
  const session = useSession();
  const status = useSessionStatus();
  const router = useRouter();

  if (!hydrated) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="surface max-w-md p-6 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <RefreshCw className="size-5 animate-spin" />
          </div>
          <h1 className="text-[16px] font-semibold">Reconnecting…</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            The gateway was briefly unreachable. We're retrying silently — your session will return
            without signing you out.
          </p>
        </div>
      </div>
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
