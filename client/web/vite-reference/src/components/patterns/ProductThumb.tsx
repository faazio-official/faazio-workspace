// 'use client'
import { ImageOff } from "lucide-react";
import { productImage, type ProductImageSource } from "@/lib/media/productImages";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-9",
  md: "size-12",
  lg: "size-16",
} as const;

/**
 * Catalogue thumbnail. Shows the real product photo the shopper sees; only
 * falls back to a marker when a listing genuinely has no image yet.
 */
export function ProductThumb({
  product,
  size = "sm",
  className,
}: {
  product: ProductImageSource & { name?: string };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const src = productImage(product);
  const base = cn(
    "shrink-0 overflow-hidden rounded-md border border-border bg-muted",
    SIZES[size],
    className,
  );

  if (!src) {
    return (
      <div
        className={cn(base, "flex items-center justify-center text-muted-foreground")}
        title="No image uploaded"
        aria-label="No image uploaded"
      >
        <ImageOff className="size-4" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={product.name ?? "Product image"}
      loading="lazy"
      width={96}
      height={96}
      className={cn(base, "object-cover")}
    />
  );
}
