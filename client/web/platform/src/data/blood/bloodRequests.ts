// Provenance: blood.requests (public board; contact is PII and redacted for anon)
import type { BloodRequestRecord } from "@/data/types";

export const BLOOD_REQUESTS: BloodRequestRecord[] = [
  {
    requestId: "br-3001",
    hospital: "KEM Hospital",
    city: "Mumbai",
    stateCode: "MH",
    bloodGroup: "O+",
    unitsRequired: 3,
    urgency: "critical",
    patientContext: "Road accident, ICU admission",
    contact: "+91-98200-00001",
    postedAt: "2026-09-25T04:10:00.000Z",
    expiresAt: "2026-10-09T04:10:00.000Z",
  },
  {
    requestId: "br-3002",
    hospital: "Manipal Hospital",
    city: "Bengaluru",
    stateCode: "KA",
    bloodGroup: "A-",
    unitsRequired: 2,
    urgency: "urgent",
    patientContext: "Scheduled surgery",
    contact: "+91-98200-00002",
    postedAt: "2026-09-24T12:00:00.000Z",
    expiresAt: "2026-10-08T12:00:00.000Z",
  },
  {
    requestId: "br-3003",
    hospital: "AIIMS",
    city: "New Delhi",
    stateCode: "DL",
    bloodGroup: "B+",
    unitsRequired: 1,
    urgency: "normal",
    patientContext: "Thalassaemia transfusion",
    contact: "+91-98200-00003",
    postedAt: "2026-09-20T09:30:00.000Z",
    expiresAt: "2026-10-04T09:30:00.000Z",
  },
];