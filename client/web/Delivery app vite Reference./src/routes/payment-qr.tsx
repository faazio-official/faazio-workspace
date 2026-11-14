import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BackHeader, RequireAuth } from "@/components/partner/Shell";
import { usePartner } from "@/lib/partner/store";

export const Route = createFileRoute("/payment-qr")({
  head: () => ({ meta: [{ title: "Payment QR · ZIP Partner" }, { name: "description", content: "Your UPI QR code and ID." }, { property: "og:title", content: "Payment QR · ZIP Partner" }, { property: "og:description", content: "Your UPI QR code and ID." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <RequireAuth><QR /></RequireAuth>,
});

function QR() {
  const { partner } = usePartner();
  return (
    <div className="min-h-screen"><BackHeader title="Payment QR Code" />
      <div className="m-4 flex flex-col items-center rounded-lg bg-card p-6 border">
        <p className="font-semibold">{partner.name}</p><p className="mb-4 text-xs text-muted-foreground">Scan to pay with any UPI app</p>
        <div className="rounded-lg border p-3"><QRCodeSVG value={`upi://pay?pa=${partner.upiId}&pn=${encodeURIComponent(partner.name)}`} size={200} fgColor="#1627E9" /></div>
        <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(partner.upiId); toast.success("UPI ID copied"); } catch { toast.error("Unable to copy UPI ID"); } }} className="mt-5 flex items-center gap-2 rounded-lg bg-primary-soft px-4 py-2 text-sm font-medium text-primary">{partner.upiId}<Copy className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
