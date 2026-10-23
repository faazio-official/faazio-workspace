"use client";
// Delivery-partner control plane. All calls are role-gated server-side (STATE_ADMIN is scoped to
// its own state; SUPER_ADMIN may act anywhere). No PII is cached client-side beyond the response.
import { remote } from "./http";
import { remoteConfigured } from "@/lib/config";
import { fileToProductImage, uploadMimeFor } from "@/lib/media/imageCompression";

export type DeliveryStatus =
  "APPLIED" | "PENDING_REVIEW" | "VERIFIED" | "ACTIVE" | "SUSPENDED" | "BLACKLISTED" | "REJECTED";

export type DeliveryVehicle = "BICYCLE" | "TWO_WHEELER" | "FOUR_WHEELER";
export type DeliveryDocStatus = "PENDING" | "VERIFIED" | "REJECTED" | "REUPLOAD_REQUESTED";

export interface DeliveryDocument {
  docId: string;
  riderId: string;
  docType: string;
  fileKey: string;
  assetId?: string;
  status: DeliveryDocStatus;
  rejectionReason?: string;
  uploadedAt: string;
}

export interface DeliveryBankAccount {
  bankAccountId: string;
  riderId: string;
  accountName: string;
  accountNumberMasked: string;
  ifsc: string;
  chequeKey?: string;
  chequeAssetId?: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason?: string;
  createdAt: string;
}

export interface DeliveryRider {
  riderId: string;
  phone?: string;
  fullName: string;
  stateCode: string;
  hubZone: string;
  address?: string;
  city: string;
  pincode: string;
  emergencyContact?: string;
  vehicleType: DeliveryVehicle;
  maxCapacity: number;
  status: DeliveryStatus;
  isAvailable: boolean;
  currentLoad: number;
  /** Admin projection from the rider's next open stop (Available / At Pickup / At Delivery / Busy). */
  currentCategory?: DeliveryRiderCategory;
  rating: number;
  completedOrders: number;
  lastHeartbeatAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export type DeliveryRiderCategory =
  | "AVAILABLE"
  | "AT_PICKUP"
  | "AT_DELIVERY"
  | "BUSY"
  | "OFFLINE";

export interface DeliveryDetail extends DeliveryRider {
  documents: DeliveryDocument[];
  bankAccount?: DeliveryBankAccount;
}

export interface DeliveryBoyLocation {
  riderId: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: string;
  source: "valkey" | "mirror" | "none";
}

export function listDeliveryApplications(
  filter: { state?: string | undefined; status?: string | undefined } = {},
) {
  return remote.get<DeliveryRider[]>("/delivery/register/pending", { query: filter });
}

export function getDeliveryApplication(id: string) {
  return remote.get<DeliveryDetail>(`/delivery/register/${encodeURIComponent(id)}`);
}

export function verifyDeliveryDocument(id: string, docType: string) {
  return remote.put<DeliveryDetail>(`/delivery/register/${encodeURIComponent(id)}/verify`, {
    docType,
  });
}

export function approveDeliveryProfile(id: string) {
  return remote.put<DeliveryDetail>(`/delivery/register/${encodeURIComponent(id)}/verify`, {
    approveProfile: true,
  });
}

export function rejectDeliveryApplication(id: string, reason: string) {
  return remote.put<DeliveryDetail>(`/delivery/register/${encodeURIComponent(id)}/reject`, {
    reason,
  });
}

/**
 * Admin-side replacement for a rejected/re-upload-requested document. The caller uploads the file
 * to the private R2 bucket first; the document returns to PENDING for normal review.
 */
export function replaceDeliveryDocument(
  id: string,
  docType: string,
  fileKey: string,
  assetId: string,
  notes = "",
) {
  return remote.put<DeliveryDetail>(
    `/delivery/register/${encodeURIComponent(id)}/documents/${encodeURIComponent(docType)}/reupload`,
    { fileKey, assetId, notes },
  );
}

/** Compress + upload a replacement KYC photo to R2, then attach it to the rider document. */
export async function uploadDeliveryDocumentReplacement(
  id: string,
  docType: string,
  file: File,
  notes = "",
) {
  if (!remoteConfigured()) {
    throw new Error("Set GATEWAY_URL to upload a replacement document.");
  }
  const dataUrl = await fileToProductImage(file);
  const blob = await (await fetch(dataUrl)).blob();
  // Compression normally returns JPEG, but the helper falls back to the original data URL when the
  // browser cannot decode it. Keep the declared MIME aligned with the bytes we actually upload.
  const mime = uploadMimeFor(blob);
  if (!mime) {
    throw new Error("Use a JPG, PNG, WebP or AVIF photo for the replacement document.");
  }
  const signed = await remote.post<{ assetId: string; key: string; uploadUrl: string }>(
    "/media/upload-url",
    {
      kind: "PRIVATE",
      ownerType: "KYC",
      ownerId: id,
      mime,
      bytes: blob.size,
    },
  );
  const put = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: blob,
  });
  if (!put.ok) throw new Error(`Replacement upload failed (${put.status}).`);
  await remote.post("/media/confirm", {
    assetId: signed.assetId,
    ownerType: "KYC",
    ownerId: id,
  });
  return replaceDeliveryDocument(id, docType, signed.key, signed.assetId, notes);
}

export function activateDeliveryPartner(id: string) {
  return remote.put<DeliveryDetail>(`/delivery/register/${encodeURIComponent(id)}/activate`);
}

export function listDeliveryRiders(
  filter: {
    state?: string | undefined;
    status?: string | undefined;
    available?: boolean | undefined;
  } = {},
) {
  return remote.get<DeliveryRider[]>("/admin/delivery-boys", { query: filter });
}

export function getDeliveryRiderLocation(id: string) {
  return remote.get<DeliveryBoyLocation>(`/admin/delivery-boys/${encodeURIComponent(id)}/location`);
}

export function suspendDeliveryPartner(id: string, reason: string) {
  return remote.put<DeliveryDetail>(`/delivery/boys/${encodeURIComponent(id)}/suspend`, { reason });
}

export function blacklistDeliveryPartner(id: string, reason: string) {
  return remote.put<DeliveryDetail>(`/delivery/boys/${encodeURIComponent(id)}/blacklist`, {
    reason,
  });
}
