import type { Role } from "@/data/types";

export type Capability =
  | "products.createOwn"
  | "products.editOwn"
  | "products.moderate"
  | "pricing.editOwn"
  | "pricing.audit"
  | "festival.caps.manage"
  | "festival.campaign.manage"
  | "festival.optin"
  | "sellers.verify"
  | "stateAdmins.manage"
  | "coupons.manage"
  | "ads.request"
  | "ads.approve"
  | "analytics.own"
  | "analytics.state"
  | "analytics.global"
  | "audit.read"
  | "settings.platform";

const MATRIX: Record<Role, Capability[]> = {
  SELLER: [
    "products.createOwn",
    "products.editOwn",
    "pricing.editOwn",
    "festival.optin",
    "ads.request",
    "analytics.own",
  ],
  STATE_ADMIN: [
    "products.moderate",
    "pricing.audit",
    "festival.campaign.manage",
    "sellers.verify",
    "coupons.manage",
    "ads.approve",
    "analytics.state",
    "audit.read",
  ],
  SUPER_ADMIN: [
    "products.moderate",
    "pricing.audit",
    "festival.caps.manage",
    "festival.campaign.manage",
    "sellers.verify",
    "stateAdmins.manage",
    "coupons.manage",
    "ads.approve",
    "analytics.state",
    "analytics.global",
    "audit.read",
    "settings.platform",
  ],
};

export function can(role: Role | undefined, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[role].includes(capability);
}

export function homeFor(role: Role): string {
  if (role === "SELLER") return "/seller";
  if (role === "STATE_ADMIN") return "/admin/state";
  return "/admin/super";
}

export const ROLE_LABEL: Record<Role, string> = {
  SELLER: "Seller",
  STATE_ADMIN: "State Admin",
  SUPER_ADMIN: "Super Admin",
};
