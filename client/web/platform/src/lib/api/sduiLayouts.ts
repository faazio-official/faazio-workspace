"use client";
// SDUI control-plane endpoints (gateway internal/sdui/control_handler.go). SUPER_ADMIN only.
import { remote } from "@/lib/api/http";
import type { SduiLayoutPayload, SduiScreen, SduiVertical } from "@/lib/sdui/layoutSchema";

export interface SduiLayoutVersion {
  id: string;
  vertical: string;
  screen: string;
  districtId: string;
  versionNum: number;
  schemaVersion: string;
  note?: string;
  publishedBy?: string;
  publishedAt: string;
  isLive: boolean;
  payload?: SduiLayoutPayload;
}

export interface SduiPointer {
  vertical: string;
  screen: string;
  districtId: string;
  versionId: string;
  versionNum: number;
  schemaVersion: string;
  epoch: number;
  publishedBy?: string;
  updatedAt: string;
}

export interface SduiDistrict {
  code: string;
  name: string;
  state: string;
}

export interface SduiUploadTicket {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

interface Scope {
  vertical: SduiVertical;
  screen: SduiScreen;
  districtId?: string;
}

export async function listSduiVersions(scope: Scope): Promise<SduiLayoutVersion[]> {
  const res = await remote.get<{ versions: SduiLayoutVersion[] | null }>("/admin/sdui/versions", {
    query: {
      vertical: scope.vertical,
      screen: scope.screen,
      district_id: scope.districtId ?? "",
    },
  });
  return res.versions ?? [];
}

export async function listSduiPointers(scope: Scope): Promise<SduiPointer[]> {
  const res = await remote.get<{ pointers: SduiPointer[] | null }>("/admin/sdui/layouts", {
    query: { vertical: scope.vertical, screen: scope.screen },
  });
  return res.pointers ?? [];
}

export async function listSduiDistricts(): Promise<SduiDistrict[]> {
  const res = await remote.get<{ districts: SduiDistrict[] | null }>("/admin/sdui/districts");
  return res.districts ?? [];
}

export async function publishSduiLayout(input: {
  vertical: SduiVertical;
  screen: SduiScreen;
  districtId: string;
  payload: SduiLayoutPayload;
  note: string;
}): Promise<SduiLayoutVersion> {
  return remote.post<SduiLayoutVersion>("/admin/sdui/layouts/publish", {
    vertical: input.vertical,
    screen: input.screen,
    district_id: input.districtId,
    note: input.note,
    payload: input.payload,
  });
}

export async function rollbackSduiLayout(input: {
  vertical: SduiVertical;
  screen: SduiScreen;
  districtId: string;
  versionId: string;
}): Promise<SduiPointer> {
  return remote.post<SduiPointer>("/admin/sdui/layouts/rollback", {
    vertical: input.vertical,
    screen: input.screen,
    district_id: input.districtId,
    version_id: input.versionId,
  });
}

export async function signSduiMediaUpload(input: {
  filename: string;
  contentType: string;
  kind: "image" | "lottie" | "video";
}): Promise<SduiUploadTicket> {
  const ticket = await remote.post<{
    upload_url: string;
    public_url: string;
    key: string;
    expires_in: number;
  }>("/admin/sdui/media/upload-url", {
    filename: input.filename,
    content_type: input.contentType,
    kind: input.kind,
  });
  return {
    uploadUrl: ticket.upload_url,
    publicUrl: ticket.public_url,
    key: ticket.key,
    expiresIn: ticket.expires_in,
  };
}

/** PUT the file straight to R2 with the presigned URL (never through the gateway). */
export async function uploadToR2(ticket: SduiUploadTicket, file: File, contentType: string): Promise<string> {
  const res = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
  return ticket.publicUrl;
}

export interface SduiLiveLayout {
  schemaVersion: string;
  serverTimestampUtc: string;
  ttlSeconds: number;
  districtId: string;
  versionNum: number;
  sduiVersionEpoch: number;
  headerTheme: SduiLayoutPayload["header_theme"];
  widgets: SduiLayoutPayload["widgets"];
}

/** The exact compiled payload the apps receive right now (server clock included). */
export async function fetchSduiLiveLayout(scope: Scope): Promise<SduiLiveLayout> {
  const res = await remote.get<{
    schema_version: string;
    server_timestamp_utc: string;
    ttl_seconds: number;
    district_id: string;
    version_num: number;
    sdui_version_epoch: number;
    header_theme: SduiLayoutPayload["header_theme"];
    widgets: SduiLayoutPayload["widgets"];
  }>("/sdui/layout", {
    query: { vertical: scope.vertical, screen: scope.screen, district_id: scope.districtId ?? "" },
  });
  return {
    schemaVersion: res.schema_version,
    serverTimestampUtc: res.server_timestamp_utc,
    ttlSeconds: res.ttl_seconds,
    districtId: res.district_id,
    versionNum: res.version_num,
    sduiVersionEpoch: res.sdui_version_epoch,
    headerTheme: res.header_theme,
    widgets: res.widgets,
  };
}
