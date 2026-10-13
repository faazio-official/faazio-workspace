// Provenance: ops.states master (state_code, name)
import type { StateInfo } from "@/data/types";

export const STATES: StateInfo[] = [
  { stateCode: "MH", name: "Maharashtra" },
  { stateCode: "DL", name: "Delhi" },
  { stateCode: "KA", name: "Karnataka" },
  { stateCode: "TN", name: "Tamil Nadu" },
  { stateCode: "GJ", name: "Gujarat" },
  { stateCode: "KL", name: "Kerala" },
];

export function stateName(code?: string): string {
  return STATES.find((s) => s.stateCode === code)?.name ?? "All states";
}
