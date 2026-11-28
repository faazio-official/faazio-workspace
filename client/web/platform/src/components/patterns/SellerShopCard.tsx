"use client";
import { useEffect, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { SectorPill } from "@/components/patterns/Pills";
import { fetchPrivateDocumentUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SellerVendorRecord } from "@/data/types";

function ShopFact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | undefined;
  mono?: boolean | undefined;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-[14px] leading-5 text-foreground",
          mono && "num",
          !value && "text-muted-foreground",
        )}
      >
        {value || "Not provided"}
      </dd>
    </div>
  );
}

/**
 * One shop of a seller application, at body size: name, address, phone, hours, category, map pin,
 * licence and photos in a labelled grid instead of a run-on meta line. The platform fee is editable
 * inline (the gateway enforces the same floor).
 */
export function SellerShopCard({
  vendor,
  busy,
  onSave,
}: {
  vendor: SellerVendorRecord;
  busy: boolean;
  onSave: (pct: number) => Promise<void>;
}) {
  const [fee, setFee] = useState(String(vendor.platformFeePct));
  const [openingLicence, setOpeningLicence] = useState(false);
  useEffect(() => setFee(String(vendor.platformFeePct)), [vendor.platformFeePct]);

  const floor = vendor.app === "FOOD" ? 5 : 1;
  const hasPin = typeof vendor.latitude === "number" && typeof vendor.longitude === "number";
  const mapUrl = hasPin
    ? `https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}`
    : null;
  const photos = vendor.photoUrls ?? [];
  const photoKeys = vendor.photoKeys ?? [];
  const licence =
    vendor.app === "PHARMA"
      ? {
          label: "Drug licence",
          number: vendor.drugLicenseNumber ?? "",
          assetId: vendor.drugLicenseCertAssetId ?? "",
        }
      : {
          label: vendor.app === "FOOD" ? "FSSAI licence" : "Shop registration certificate",
          number: vendor.fssaiNumber ?? "",
          assetId: vendor.fssaiCertAssetId ?? "",
        };

  const openLicence = async () => {
    if (!licence.assetId) return;
    setOpeningLicence(true);
    try {
      const url = await fetchPrivateDocumentUrl(licence.assetId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("This licence has no downloadable file");
    } catch {
      toast.error("Could not open this licence");
    } finally {
      setOpeningLicence(false);
    }
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-[14px] font-semibold text-foreground">{vendor.name}</h3>
            <SectorPill sector={vendor.app} />
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", vendor.isLive ? "bg-success" : "bg-muted-foreground")}
              />
              {vendor.isLive ? "Live" : "Paused"}
            </span>
          </div>
          <p className="num mt-0.5 text-[12px] text-muted-foreground">{vendor.storeId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">Platform fee</span>
          <Input
            className="num h-9 w-20"
            value={fee}
            inputMode="numeric"
            aria-label={`Platform fee percent for ${vendor.name}`}
            onChange={(e) => setFee(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              const pct = Number(fee);
              if (!Number.isInteger(pct) || pct < floor || pct > 100) {
                toast.error(`Allowed: ${floor}–100% for ${vendor.app}`);
                return;
              }
              void onSave(pct);
            }}
          >
            Save fee
          </Button>
          <ComponentHelp id="fee-input" label="About the platform fee" />
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[12px] text-muted-foreground">Shop address</dt>
          <dd className="mt-0.5 flex items-start gap-1.5 text-[14px] leading-5 text-foreground">
            <MapPin className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              {vendor.address || <span className="text-muted-foreground">No shop address stored</span>}
            </span>
          </dd>
        </div>
        <ShopFact label="Shop phone" value={vendor.phone} mono />
        <ShopFact label="Opening hours" value={vendor.hours} />
        <ShopFact label="Category" value={vendor.sellerCategoryId} mono />
        <div className="min-w-0">
          <dt className="text-[12px] text-muted-foreground">Map pin</dt>
          <dd className="mt-0.5 text-[14px] leading-5">
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="num inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {vendor.latitude?.toFixed(5)}, {vendor.longitude?.toFixed(5)}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : (
              <span className="text-muted-foreground">No map pin stored</span>
            )}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[12px] text-muted-foreground">{licence.label}</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-[14px] leading-5">
            <span className="num">
              {licence.number || <span className="text-muted-foreground">Number not provided</span>}
            </span>
            {licence.assetId ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy || openingLicence}
                onClick={() => void openLicence()}
              >
                View certificate
              </Button>
            ) : (
              <span className="text-[12px] text-destructive">No certificate file uploaded</span>
            )}
          </dd>
        </div>
      </dl>

      {photos.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={`Shop photo ${i + 1}`}>
              <img
                src={url}
                alt={`${vendor.name} shop photo ${i + 1}`}
                className="size-24 rounded-lg border border-border object-cover"
              />
            </a>
          ))}
        </div>
      ) : photoKeys.length ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {photoKeys.length} AVIF shop photo{photoKeys.length === 1 ? "" : "s"} stored (preview unavailable)
        </p>
      ) : (
        <p className="mt-3 text-[13px] text-muted-foreground">No shop photos stored.</p>
      )}
    </div>
  );
}
