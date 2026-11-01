"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { MAX_PRODUCT_IMAGES, resolveImage, uploadProductImage } from "@/lib/media/productImages";
import { cn } from "@/lib/utils";

/**
 * Product photo uploader: drag-and-drop or pick files, reorder the primary
 * shot, and remove images. With Supabase configured the value stored is a
 * Storage object key; otherwise a compressed data URL keeps the demo working.
 */
export function ImageUploader({
  images,
  onChange,
  max = MAX_PRODUCT_IMAGES,
  label = "Product photos",
  hint = "First photo is the one shoppers see on cards and search. JPG, PNG or WebP up to 8 MB.",
}: {
  images: string[];
  onChange: (next: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function ingest(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = max - images.length;
    if (room <= 0) {
      toast.error(`You can keep up to ${max} photos on a listing.`);
      return;
    }
    setBusy(true);
    const accepted: string[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        accepted.push(await uploadProductImage(file));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That image could not be added.");
      }
    }
    setBusy(false);
    if (accepted.length > 0) {
      onChange([...images, ...accepted]);
      toast.success(accepted.length === 1 ? "Photo added" : `${accepted.length} photos added`);
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-medium">{label}</p>
          <ComponentHelp helpKey="pattern:image-uploader" label="About uploading photos" />
        </div>
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {images.map((src, index) => (
          <div
            key={`${index}-${src.slice(-24)}`}
            className="group relative size-24 overflow-hidden rounded-lg border border-border bg-muted"
          >
            <img src={resolveImage(src) ?? src} alt={`Product photo ${index + 1}`} className="size-full object-cover" />
            {index === 0 ? (
              <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                Primary
              </span>
            ) : null}
            <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {index > 0 ? (
                <button
                  type="button"
                  title="Make primary"
                  aria-label="Make primary photo"
                  className="rounded bg-card/95 p-1 text-foreground shadow-sm"
                  onClick={() =>
                    onChange([images[index] as string, ...images.filter((_, i) => i !== index)])
                  }
                >
                  <Star className="size-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                title="Remove photo"
                aria-label="Remove photo"
                className="rounded bg-card/95 p-1 text-destructive shadow-sm"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        {images.length < max ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void ingest(e.dataTransfer.files);
            }}
            className={cn(
              "flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[11px] transition-colors",
              dragging
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary",
            )}
          >
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="size-5" />
                Upload
              </>
            )}
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void ingest(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <p className="num text-[12px] text-muted-foreground">
          {images.length} / {max} photos
        </p>
      </div>
    </div>
  );
}
