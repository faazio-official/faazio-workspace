"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/hooks/useSession";
import { changePortalPassword } from "@/lib/portal/auth";
import { signOut } from "@/lib/api";

export function AccountSecurity() {
  const router = useRouter();
  const session = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (newPassword.length < 12) {
      setError("Use at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await changePortalPassword(currentPassword, newPassword);
      toast.success("Password changed — sign in again with the new password.");
      await signOut();
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Account security"
        description="Change your portal password. Changing it signs out every other device."
      />

      {session?.mustChange ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px]">
          You are still using a temporary password. Change it now to continue.
        </div>
      ) : null}

      <SectionCard title="Change password">
        <div className="grid max-w-md gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-[12px] text-muted-foreground">
              At least 12 characters. A temporary password cannot be reused.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <div className="flex justify-end">
            <Button disabled={busy} onClick={() => void submit()}>
              {busy ? "Changing…" : "Change password"}
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
