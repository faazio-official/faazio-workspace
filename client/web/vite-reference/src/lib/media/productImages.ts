// Browser-safe media resolver. Seeded catalogue rows carry `mock://img/<id>.jpg`
// placeholders; those map to real bundled photos. Seller uploads are stored as
// data URLs on the product row, so they win over the seeded photo.
import fmM1 from "@/assets/products/fm-m1.jpg";
import mdM1 from "@/assets/products/md-1.jpg";
import fmF1 from "@/assets/products/fm-f1.jpg";
import grP7 from "@/assets/products/gr-p7.jpg";
import fd1 from "@/assets/products/fd-1.jpg";
import fd2 from "@/assets/products/fd-2.jpg";
import ph1 from "@/assets/products/ph-1.jpg";
import ph2 from "@/assets/products/ph-2.jpg";

const SEEDED: Record<string, string> = {
  "fm-m1": fmM1,
  "md-1": mdM1,
  "fm-f1": fmF1,
  "gr-p7": grP7,
  "fd-1": fd1,
  "fd-2": fd2,
  "ph-1": ph1,
  "ph-2": ph2,
};

export interface ProductImageSource {
  productId: string;
  imageUrl?: string | undefined;
  galleryUrls?: string[] | undefined;
}

function usable(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("mock://")) return null;
  return url;
}

/** Primary image for a product card, table row or detail header. */
export function productImage(product: ProductImageSource): string | null {
  return usable(product.imageUrl) ?? SEEDED[product.productId] ?? null;
}

/** Every image for a product, primary first, de-duplicated. */
export function productGallery(product: ProductImageSource): string[] {
  const primary = productImage(product);
  const extras = (product.galleryUrls ?? []).map(usable).filter((u): u is string => u !== null);
  return [...new Set([...(primary ? [primary] : []), ...extras])];
}

export const MAX_PRODUCT_IMAGES = 5;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

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
