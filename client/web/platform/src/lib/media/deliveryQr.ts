// Delivery UPI QR upload. Reuses the gateway media registry → Cloudflare R2 flow
// (`POST /media/upload-url` → presigned PUT → `POST /media/confirm`) with the QR owner type
// (migration 0077). Returns the displayable public URL plus the R2 asset id; the superadmin saves
// both through `updateDeliveryUpipQr`.
import { remoteConfigured } from "@/lib/config";
import { remote } from "@/lib/api/http";
import { fileToProductImage, uploadMimeFor } from "./imageCompression";
import { R2_PREFIX, resolveImage } from "./productImages";

/** Uploads the delivery UPI QR as a PUBLIC R2 asset. Falls back to a data URL in seed mode. */
export async function uploadDeliveryQr(file: File): Promise<{ qrUrl: string; assetId?: string }> {
  const dataUrl = await fileToProductImage(file);

  if (remoteConfigured()) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const mime = uploadMimeFor(blob);
      if (!mime) throw new Error("unsupported image type");
      const hash = await sha256Hex(blob);
      const signed = await remote.post<{ assetId: string; key: string; uploadUrl: string }>(
        "/media/upload-url",
        { kind: "PUBLIC", ownerType: "QR", mime, bytes: blob.size, hash },
      );
      const put = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: blob,
      });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      await remote.post("/media/confirm", { assetId: signed.assetId, ownerType: "QR" });
      return { qrUrl: resolveImage(`${R2_PREFIX}${signed.key}`) ?? "", assetId: signed.assetId };
    } catch {
      // fall through to the data-URL path
    }
  }

  return { qrUrl: dataUrl };
}

/** SHA-256 (hex) of a blob — content-addressed dedup for the R2 registry. "" when unavailable. */
async function sha256Hex(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) return "";
  try {
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}