"use client";
// Delivery-partner control plane. All calls are role-gated server-side (STATE_ADMIN is scoped to
// its own state; SUPER_ADMIN may act anywhere). No PII is cached client-side beyond the response.
import { remote } from "./http";

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
  rating: number;
  completedOrders: number;
  lastHeartbeatAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

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

export function requestDeliveryReupload(id: string, docType: string, reason: string) {
  return remote.put<DeliveryDetail>(
    `/delivery/register/${encodeURIComponent(id)}/reupload-request`,
    {
      docType,
      reason,
    },
  );
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
