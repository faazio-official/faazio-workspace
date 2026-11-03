// Private KYC uploads: the gateway mints a PRIVATE asset and a presigned PUT; the browser uploads
// straight to R2 and confirms. No data-URL fallback — a missing gateway is a hard error.
import { remoteConfigured } from "@/lib/config";
import { ApiError, remote } from "@/lib/api/http";
import { fileToProductImage, uploadMimeFor } from "./imageCompression";

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

export interface PrivateUpload {
  key: string;
  assetId: string;
}

/** Uploads a private document (FSSAI certificate, passbook) and returns its R2 key + asset id. */
export async function uploadPrivateDocument(file: File): Promise<PrivateUpload> {
  if (!remoteConfigured()) throw new ApiError(0, "unconfigured", "Gateway is not configured");
  const dataUrl = await fileToProductImage(file);
  const blob = await (await fetch(dataUrl)).blob();
  const mime = uploadMimeFor(blob);
  if (!mime) throw new ApiError(400, "bad_request", "unsupported image type");
  const hash = await sha256Hex(blob);
  const signed = await remote.post<{ assetId: string; key: string; uploadUrl: string }>(
    "/media/upload-url",
    { kind: "PRIVATE", ownerType: "KYC", mime, bytes: blob.size, hash },
  );
  const put = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: blob,
  });
  if (!put.ok) throw new ApiError(put.status, "upload_failed", `Upload failed (${put.status})`);
  await remote.post("/media/confirm", { assetId: signed.assetId, ownerType: "KYC" });
  return { key: signed.key, assetId: signed.assetId };
}
