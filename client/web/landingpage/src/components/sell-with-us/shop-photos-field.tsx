import { useRef, useState } from "react";
import { HiOutlineCamera, HiOutlineTrash } from "react-icons/hi2";
import { uploadShopPhoto, type ShopPhotoRef } from "@/lib/inquiries";

/**
 * Shop-front photos for the public enquiry.
 *
 * Every photo is converted to AVIF by the gateway, so this component's job is to make the source as
 * cheap as possible: downscale to 1600px on the long edge in a canvas and re-encode JPEG (which also
 * drops the camera's EXIF/GPS before the bytes ever leave the browser), then hand the base64 to the
 * `uploadShopPhoto` server function.
 *
 * The upload happens on pick, not on submit, so the visitor sees each photo confirm immediately and
 * the final POST carries only asset ids.
 */

/** Matches the gateway's `maxAVIFLongEdge` — downscaling here only wastes bytes if it is larger. */
const MAX_EDGE = 1600;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PHOTOS = 5;

async function toJpegBase64(file: File): Promise<{ data: string; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), preview: dataUrl };
}

export function ShopPhotosField({
  photos,
  onChange,
  error,
}: {
  photos: ShopPhotoRef[];
  onChange: (next: ShopPhotoRef[]) => void;
  error?: string | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setUploadError("");
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setUploadError(`Up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const chosen = Array.from(files).slice(0, room);
    setBusy(true);
    const next = [...photos];
    for (const file of chosen) {
      if (!file.type.startsWith("image/")) {
        setUploadError("Those are not images. Use JPG or PNG photos of your shop.");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setUploadError("One of those photos is over 20 MB. Pick a smaller one.");
        continue;
      }
      try {
        const { data } = await toJpegBase64(file);
        const result = await uploadShopPhoto({ data: { data, mime: "image/jpeg" } });
        if (!result.ok) {
          setUploadError(result.message);
          continue;
        }
        next.push(result.photo);
        onChange([...next]);
      } catch {
        setUploadError("One of those photos could not be read. Try a different one.");
      }
    }
    setBusy(false);
  }

  return (
    <div className="field">
      <span className="sell-photos-label" id="shop-photos-label">
        Photos of your shop <span className="sell-photos-required">(at least one)</span>
      </span>
      <p className="field-hint" id="shop-photos-hint">
        A photo of the shop front helps the partner team and is what customers see once you go live.
      </p>

      <div className="sell-photos" role="group" aria-labelledby="shop-photos-label">
        {photos.map((photo, index) => (
          <figure key={photo.assetId} className="sell-photo">
            {photo.url ? (
              <img src={photo.url} alt={`Shop photo ${index + 1}`} loading="lazy" />
            ) : (
              <span className="sell-photo-fallback">Photo {index + 1}</span>
            )}
            <button
              type="button"
              className="sell-photo-remove"
              aria-label={`Remove shop photo ${index + 1}`}
              onClick={() => onChange(photos.filter((p) => p.assetId !== photo.assetId))}
            >
              <HiOutlineTrash aria-hidden="true" />
            </button>
          </figure>
        ))}

        {photos.length < MAX_PHOTOS ? (
          <button
            type="button"
            className="sell-photo-add"
            disabled={busy}
            aria-describedby="shop-photos-hint"
            onClick={() => inputRef.current?.click()}
          >
            <HiOutlineCamera aria-hidden="true" />
            <span>{busy ? "Uploading…" : photos.length ? "Add another" : "Add a photo"}</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sell-honeypot"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void pick(event.target.files);
          event.target.value = "";
        }}
      />

      {error ? <p className="field-error">{error}</p> : null}
      {uploadError ? (
        <p className="field-error" role="alert">
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}
