// Browser-only image compression shared by product and KYC uploads. Kept separate from the
// product-image resolver so non-product flows do not pull the bundled product photos as assets.
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Reads a picked file and returns a compressed JPEG data URL, so uploads survive a
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
