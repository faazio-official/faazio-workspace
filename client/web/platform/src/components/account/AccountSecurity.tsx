"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/hooks/useSession";
import { changePortalPassword, PortalError } from "@/lib/portal/auth";
import { homeFor } from "@/lib/auth/permissions";
import { signIn, signOut } from "@/lib/api";
import { hydrateFromGateway } from "@/lib/api/sync";

/** Surface the specific server validation code instead of the generic fallback. */
function changePasswordErrorMessage(err: unknown): string {
  if (err instanceof PortalError) {
    if (err.code === "weak_password") {
      return "Use a stronger, different password: at least 12 characters, not a common value.";
    }
    if (err.code === "invalid_current_password") {
      return "Your current password is incorrect.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Could not change the password.";
}

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
    // The password route cleared this browser's HttpOnly cookies (the gateway revoked every
    // refresh session and denylisted the current access token). Mint a fresh session with the new
    // password instead of bouncing the user to /login — otherwise every /api/gateway/* call 401s
    // behind a stale "zombie" session. Do NOT call signOut(): it would unregister this device's
    // push token, which is wrong for a voluntary rotation.
    try {
      await changePortalPassword(currentPassword, newPassword);
    } catch (err) {
      setError(changePasswordErrorMessage(err));
      setBusy(false);
      return;
    }
    try {
      if (!session?.email) throw new Error("No session email");
      const user = await signIn(session.email, newPassword);
      await hydrateFromGateway();
      toast.success("Password changed — signed in with your new password.");
      router.push(homeFor(user.role));
    } catch {
      // Fallback: the fresh session could not be minted (race/edge). Force a clean manual sign-in.
      await signOut();
      toast.success("Password changed — sign in again with the new password.");
      router.push("/login");
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

      {session?.mustChange && session.role !== "SUPER_ADMIN" ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px]">
          You are still using a temporary password. Change it now to continue.
        </div>
      ) : null}

      <SectionCard title="Change password">
        <div className="grid max-w-md gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <ComponentHelp
                helpKey="pattern:account-current-password"
                label="About your current password"
              />
            </div>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <ComponentHelp
                helpKey="pattern:account-new-password"
                label="About the new password"
              />
            </div>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-[12px] text-muted-foreground">
              At least 12 characters. Choose a strong, different password.
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
              {busy ? "Changing..." : "Change password"}
            </Button>
            <ComponentHelp helpKey="pattern:account-submit" label="About changing your password" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
