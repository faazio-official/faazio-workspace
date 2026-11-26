import type { LegalMetrology, NetUnit, PackType } from "@/data/types";

/** Packaging forms the catalog accepts. Mirrors `catalog.products.pack_type` (0137). */
export const PACK_TYPES: { value: PackType; label: string }[] = [
  { value: "PIECE", label: "Piece" },
  { value: "PACKET", label: "Packet" },
  { value: "BUNDLE", label: "Bundle" },
  { value: "BOX", label: "Box" },
  { value: "KG", label: "Kilogram" },
  { value: "G", label: "Gram" },
  { value: "L", label: "Litre" },
  { value: "ML", label: "Millilitre" },
  { value: "STRIP", label: "Strip" },
  { value: "DOZEN", label: "Dozen" },
  { value: "SET", label: "Set" },
];

/** Net units the catalog accepts. Mirrors `catalog.products.net_unit` (0137). */
export const NET_UNITS: { value: NetUnit; label: string }[] = [
  { value: "piece", label: "piece" },
  { value: "tablet", label: "tablet" },
  { value: "sheet", label: "sheet" },
  { value: "pack", label: "pack" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "l" },
];

/** Unit-of-measure pack types lock their net unit so a seller cannot pick `KG` + `ml`. */
export function lockedNetUnit(packType: PackType | ""): NetUnit | undefined {
  switch (packType) {
    case "KG":
      return "kg";
    case "G":
      return "g";
    case "L":
      return "l";
    case "ML":
      return "ml";
    case "PIECE":
      return "piece";
    default:
      return undefined;
  }
}

/** Legacy display string the shopper sees. Mirrors the gateway's `deriveUnit`. */
export function deriveUnit(packType: PackType | "", netQty: number | undefined, netUnit: NetUnit | ""): string {
  if (!packType || netQty === undefined || netQty <= 0) return "";
  const q = String(netQty);
  switch (packType) {
    case "KG":
    case "G":
    case "L":
    case "ML":
      return `${q} ${netUnit}`;
    case "PIECE":
      return netQty === 1 ? "1 piece" : `${q} pieces`;
    case "PACKET":
      return `Pack of ${q}`;
    case "BOX":
      return `Box of ${q}`;
    case "BUNDLE":
      return `Bundle of ${q}`;
    case "DOZEN":
      return `Dozen (${q})`;
    case "SET":
      return `Set of ${q}`;
    case "STRIP":
      return `Strip of ${q} ${netQty === 1 ? "tablet" : "tablets"}`;
    default:
      return "";
  }
}

export const RETURN_POLICIES = [
  { value: "7_DAY_REPLACEMENT", label: "7-day replacement" },
  { value: "NON_RETURNABLE", label: "Non-returnable" },
  { value: "NO_RETURN_FOOD", label: "No return on food" },
  { value: "MANUFACTURER_WARRANTY", label: "Manufacturer warranty" },
];

export const EMPTY_COMPLIANCE: LegalMetrology = {
  countryOfOrigin: "India",
  returnPolicy: "7_DAY_REPLACEMENT",
};

/** Defaults for loose produce/fresh: the store itself is the packer/seller entity. */
export function complianceFromStore(
  storeName: string,
  storeAddress: string,
  existing?: LegalMetrology,
): LegalMetrology {
  return {
    ...EMPTY_COMPLIANCE,
    ...existing,
    packerName: existing?.packerName || storeName,
    packerAddress: existing?.packerAddress || storeAddress,
    manufacturerName: existing?.manufacturerName || storeName,
    manufacturerAddress: existing?.manufacturerAddress || storeAddress,
  };
}
