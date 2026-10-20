// Provenance: ISO 3166-2:IN (36) — 28 States + 8 Union Territories. Mirrors the planned
// ops.states seed (0035); frontend fallback when the gateway is offline. Contested codes per
// ISO (aliases are rejected at the gateway with `unknown_state` so typos surface fast):
// CT not CG (Chhattisgarh), OR not OD (Odisha), TG not TS (Telangana), UT not UK (Uttarakhand),
// DH not DN/DD (Dadra and Nagar Haveli and Daman and Diu, merged UT since 2020).
// Sorted by name (not code) for scannability in dropdowns.
import type { StateInfo } from "@/data/types";

export const STATES: StateInfo[] = [
  { stateCode: "AN", name: "Andaman and Nicobar Islands (UT)" },
  { stateCode: "AP", name: "Andhra Pradesh" },
  { stateCode: "AR", name: "Arunachal Pradesh" },
  { stateCode: "AS", name: "Assam" },
  { stateCode: "BR", name: "Bihar" },
  { stateCode: "CH", name: "Chandigarh (UT)" },
  { stateCode: "CT", name: "Chhattisgarh" },
  { stateCode: "DH", name: "Dadra and Nagar Haveli and Daman and Diu (UT)" },
  { stateCode: "DL", name: "Delhi — National Capital Territory (UT)" },
  { stateCode: "GA", name: "Goa" },
  { stateCode: "GJ", name: "Gujarat" },
  { stateCode: "HR", name: "Haryana" },
  { stateCode: "HP", name: "Himachal Pradesh" },
  { stateCode: "JK", name: "Jammu and Kashmir (UT)" },
  { stateCode: "JH", name: "Jharkhand" },
  { stateCode: "KA", name: "Karnataka" },
  { stateCode: "KL", name: "Kerala" },
  { stateCode: "LA", name: "Ladakh (UT)" },
  { stateCode: "LD", name: "Lakshadweep (UT)" },
  { stateCode: "MP", name: "Madhya Pradesh" },
  { stateCode: "MH", name: "Maharashtra" },
  { stateCode: "MN", name: "Manipur" },
  { stateCode: "ML", name: "Meghalaya" },
  { stateCode: "MZ", name: "Mizoram" },
  { stateCode: "NL", name: "Nagaland" },
  { stateCode: "OR", name: "Odisha" },
  { stateCode: "PY", name: "Puducherry (UT)" },
  { stateCode: "PB", name: "Punjab" },
  { stateCode: "RJ", name: "Rajasthan" },
  { stateCode: "SK", name: "Sikkim" },
  { stateCode: "TN", name: "Tamil Nadu" },
  { stateCode: "TG", name: "Telangana" },
  { stateCode: "TR", name: "Tripura" },
  { stateCode: "UP", name: "Uttar Pradesh" },
  { stateCode: "UT", name: "Uttarakhand" },
  { stateCode: "WB", name: "West Bengal" },
];

const UT_CODES = new Set(["AN", "CH", "DH", "DL", "JK", "LA", "LD", "PY"]);

/** Groups a state code as STATE or UT, so selects can render `<optgroup>`-style sections. */
export function stateKind(code?: string): "STATE" | "UT" {
  return code && UT_CODES.has(code) ? "UT" : "STATE";
}

export function stateName(code?: string): string {
  return STATES.find((s) => s.stateCode === code)?.name ?? "All states";
}