// Browser-safe media resolver. Seed rows carry `mock://img/<id>.jpg` placeholders
// that map to bundled photos for the demo. Everything else is a Storage object
// key (D6/D7): sold products store the key, never a URL, and the public URL is
// derived here. Uploads go to Supabase Storage when configured, else fall back
// to a compressed data URL so the demo keeps working.
import { authConfigured, config } from "@/lib/config";
import { accessToken } from "@/lib/supabase/auth";
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

/** Supabase Storage bucket that holds seller product photos. */
export const PRODUCT_BUCKET = "product-images";

export interface ProductImageSource {
  productId: string;
  imageUrl?: string | undefined;
  galleryUrls?: string[] | undefined;
}

/**
 * Resolves a stored value to a displayable URL. Handles remote URLs, data URLs,
 * and Storage object keys (everything without a scheme). Seeded `mock://`
 * placeholders resolve to null so the bundled fallback wins.
 */
export function resolveImage(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("mock://")) return null;
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;
  if (/^https?:\/\//.test(value)) return value;
  // Storage object key -> public object URL.
  return `${config.supabaseUrl}/storage/v1/object/public/${PRODUCT_BUCKET}/${value.replace(/^\/+/, "")}`;
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
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Uploads a picked photo. With Supabase configured and a session present the
 * compressed JPEG is stored in the bucket and the object key is returned;
 * otherwise the compressed data URL is returned (local seed mode).
 */
export async function uploadProductImage(file: File): Promise<string> {
  const dataUrl = await fileToProductImage(file);
  if (!authConfigured()) return dataUrl;
  const token = accessToken();
  if (!token) return dataUrl;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `seller/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const res = await fetch(
      `${config.supabaseUrl}/storage/v1/object/${PRODUCT_BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: config.supabaseAnonKey,
          "Content-Type": "image/jpeg",
          "x-upsert": "false",
        },
        body: blob,
      },
    );
    return res.ok ? path : dataUrl;
  } catch {
    return dataUrl;
  }
}

/**
 * Reads a picked file and returns a compressed data URL, so uploads survive a
 * page reload without a storage backend. Runs in the browser only.
 */
export async function fileToProductImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file is not an image. Use a JPG, PNG or WebP photo.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That image is larger than 8 MB. Please pick a smaller photo.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });

  try {
    return await compress(dataUrl, 900, 0.82);
  } catch {
    return dataUrl;
  }
}

function compress(dataUrl: string, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => reject(new Error("Could not decode that image."));
    image.src = dataUrl;
  });
}
