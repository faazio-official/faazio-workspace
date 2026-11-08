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
  | "districtAdmins.manage"
  | "coupons.manage"
  | "ads.request"
  | "ads.approve"
  | "analytics.own"
  | "analytics.district"
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
  DISTRICT_ADMIN: [
    "products.moderate",
    "pricing.audit",
    "festival.campaign.manage",
    "sellers.verify",
    "coupons.manage",
    "ads.approve",
    "analytics.district",
    "audit.read",
  ],
  SUPER_ADMIN: [
    "products.moderate",
    "pricing.audit",
    "festival.caps.manage",
    "festival.campaign.manage",
    "sellers.verify",
    "districtAdmins.manage",
    "coupons.manage",
    "ads.approve",
    "analytics.district",
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
  if (role === "SELLER") return "/seller/orders";
  if (role === "DISTRICT_ADMIN") return "/admin/district";
  return "/admin/super";
}

/**
 * Default landing route for the current console, used by error/not-found boundaries that render
 * outside the authenticated shell (where no role may be known). Mirrors `homeFor` per area so
 * "Go home" never dumps a seller on the public landing page.
 */
export function homeForPath(pathname: string): string {
  if (pathname === "/seller" || pathname.startsWith("/seller/")) return homeFor("SELLER");
  if (pathname === "/admin/district" || pathname.startsWith("/admin/district/"))
    return homeFor("DISTRICT_ADMIN");
  if (pathname === "/admin/super" || pathname.startsWith("/admin/super/")) return homeFor("SUPER_ADMIN");
  return "/";
}

export const ROLE_LABEL: Record<Role, string> = {
  SELLER: "Seller",
  DISTRICT_ADMIN: "District Admin",
  SUPER_ADMIN: "Super Admin",
};
