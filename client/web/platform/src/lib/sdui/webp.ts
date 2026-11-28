"use client";
// Browser-side WebP conversion before an SDUI banner upload. Falls back to the original file when
// the browser cannot encode WebP (the gateway accepts JPEG/PNG too).
export async function toWebp(file: File, quality = 0.85): Promise<File> {
  if (file.type === "image/webp") return file;
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality });
    if (!blob || blob.type !== "image/webp") return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "banner";
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
