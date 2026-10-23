// Browser-safe media resolver. Seed rows carry `mock://img/<id>.jpg` placeholders
// that map to bundled photos for the demo. Uploads go through the gateway media
// registry to Cloudflare R2 (`POST /media/upload-url` → presigned PUT →
// `POST /media/confirm`); the stored value is an `r2:<key>` reference resolved
// here to the CDN origin. When the gateway is unset, uploads fall back to a
// compressed data URL so local development keeps working.
import { config, remoteConfigured } from "@/lib/config";
import { remote } from "@/lib/api/http";
import { fileToProductImage, uploadMimeFor } from "./imageCompression";
import fmM1 from "@/assets/products/fm-m1.jpg";
import mdM1 from "@/assets/products/md-1.jpg";
import fmF1 from "@/assets/products/fm-f1.jpg";
import grP7 from "@/assets/products/gr-p7.jpg";
import fd1 from "@/assets/products/fd-1.jpg";
import fd2 from "@/assets/products/fd-2.jpg";
import ph1 from "@/assets/products/ph-1.jpg";
import ph2 from "@/assets/products/ph-2.jpg";

// Vite resolves image imports to a URL string; Next resolves them to
// { src, width, height }. Normalise in this one place so <img src> stays a
// plain string everywhere (ProductThumb, ImageUploader, previews).
type ImageModule = string | { src: string };

function toUrl(image: ImageModule): string {
  return typeof image === "string" ? image : image.src;
}

const SEEDED: Record<string, string> = {
  "fm-m1": toUrl(fmM1),
  "md-1": toUrl(mdM1),
  "fm-f1": toUrl(fmF1),
  "gr-p7": toUrl(grP7),
  "fd-1": toUrl(fd1),
  "fd-2": toUrl(fd2),
  "ph-1": toUrl(ph1),
  "ph-2": toUrl(ph2),
};

/** Prefix for a Cloudflare R2 object reference stored in a product's image fields. */
export const R2_PREFIX = "r2:";

export interface ProductImageSource {
  productId: string;
  imageUrl?: string | undefined;
  galleryUrls?: string[] | undefined;
}

/**
 * Resolves a stored value to a displayable URL. Handles remote URLs, data URLs
 * and `r2:<key>` R2 references. Seeded `mock://` placeholders (and any legacy
 * storage key without a scheme) resolve to null so the bundled fallback wins.
 */
export function resolveImage(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("mock://")) return null;
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith(R2_PREFIX)) {
    const key = value.slice(R2_PREFIX.length).replace(/^\/+/, "");
    return config.mediaCdnBase ? `${config.mediaCdnBase}/${key}` : null;
  }
  return null;
}

/** Primary image for a product card, table row or detail header. */
export function productImage(product: ProductImageSource): string | null {
  return resolveImage(product.imageUrl) ?? SEEDED[product.productId] ?? null;
}

/** Every image for a product, primary first, de-duplicated. */
export function productGallery(product: ProductImageSource): string[] {
  const primary = productImage(product);
  const extras = (product.galleryUrls ?? [])
    .map(resolveImage)
    .filter((u): u is string => u !== null);
  return [...new Set([...(primary ? [primary] : []), ...extras])];
}

export const MAX_PRODUCT_IMAGES = 5;

/**
 * Uploads a picked photo. With the gateway configured the compressed JPEG goes
 * to Cloudflare R2 via the media registry and the stored value is `r2:<key>`;
 * without it, a compressed data URL keeps local development working.
 */
export async function uploadProductImage(file: File, ownerType = "PRODUCT"): Promise<string> {
  const dataUrl = await fileToProductImage(file);

  if (remoteConfigured()) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const mime = uploadMimeFor(blob);
      if (!mime) throw new Error("unsupported image type");
      const hash = await sha256Hex(blob);
      const signed = await remote.post<{ assetId: string; key: string; uploadUrl: string }>(
        "/media/upload-url",
        { kind: "PUBLIC", ownerType, mime, bytes: blob.size, hash },
      );
      const put = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: blob,
      });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      await remote.post("/media/confirm", { assetId: signed.assetId, ownerType });
      return `${R2_PREFIX}${signed.key}`;
    } catch {
      // fall through to the data-URL path
    }
  }

  return dataUrl;
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
