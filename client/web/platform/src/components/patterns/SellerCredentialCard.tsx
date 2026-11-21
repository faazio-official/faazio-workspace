"use client";
// One-time seller portal credential, shown the moment an application is approved. The gateway mints
// the login from the application's contact email and returns the temporary password exactly once
// (it is Argon2id-hashed at rest and never logged), so this card is the only chance to share it.
// Everything here is copy/WhatsApp only — nothing re-reads a stored password, because none exists.
import Link from "next/link";
import { toast } from "sonner";
import { Copy, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SellerLoginCredential } from "@/data/types";

/** Digits-only phone for a wa.me deep link; empty when the number cannot be a real destination. */
function waNumber(phone: string | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : "";
}

/** Pre-filled WhatsApp hand-over message. Never contains more than the admin is about to copy. */
export function sellerLoginMessage(input: {
  businessName?: string | undefined;
  email?: string | undefined;
  password?: string | undefined;
}): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const lines = [
    input.businessName ? `Hi ${input.businessName}, your Faazio Partner Portal login is ready.` : "Your Faazio Partner Portal login is ready.",
    origin ? `Sign in: ${origin}/login` : "Sign in via the Faazio Partner Portal.",
    input.email ? `Email: ${input.email}` : "",
    input.password ? `Temporary password: ${input.password}` : "",
    "You will be asked to set your own password at first sign-in.",
  ];
  return lines.filter(Boolean).join("\n");
}

async function copy(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error("Could not copy — select the text manually");
  }
}

/** Hand the login to the seller on WhatsApp (no phone → clipboard + a plain note instead). */
function shareOnWhatsApp(phone: string | undefined, message: string) {
  const number = waNumber(phone);
  if (!number) {
    void copy(message, "No phone on file — the login message was copied");
    return;
  }
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

export function SellerCredentialCard({
  credential,
  businessName,
  phone,
}: {
  credential: SellerLoginCredential;
  businessName?: string | undefined;
  /** The seller's registered contact phone — the WhatsApp hand-over destination. */
  phone?: string | undefined;
}) {
  if (credential.skipped) {
    return (
      <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
        <p className="text-[13px]">
          No login was auto-created: {credential.reason ?? "provisioning skipped"}. The application is
          approved regardless — issue a login manually once the seller has a usable email.
        </p>
        <Link
          href="/admin/super/credentials"
          className="inline-flex text-[12px] font-semibold text-interactive hover:underline"
        >
          Open portal credentials →
        </Link>
      </div>
    );
  }

  const email = credential.email ?? "";
  const password = credential.created ? credential.temporaryPassword : undefined;
  const message = sellerLoginMessage({ businessName, email, password: password ?? undefined });

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</p>
        <p className="num select-all text-[13px]">{email || "—"}</p>
        {password ? (
          <>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              Temporary password
            </p>
            <p className="num select-all text-[13px]">{password}</p>
          </>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" />
            An existing login for this seller was reused — its password was not changed.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {password ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void copy(`${email}\n${password}`, "Login copied")}
          >
            <Copy className="size-3.5" /> Copy login
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void copy(email, "Email copied")}
          >
            <Copy className="size-3.5" /> Copy email
          </Button>
        )}
        <Button size="sm" className="gap-1.5" onClick={() => shareOnWhatsApp(phone, message)}>
          <MessageCircle className="size-3.5" /> Share on WhatsApp
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {password
          ? "Shown once and never stored in the clear — copy it now. The seller must change it at first sign-in."
          : "Only an email hand-over is possible: the stored password cannot be read back. Reset it from Portal credentials if the seller lost it."}
      </p>
    </div>
  );
}
