// Provenance: auth.accounts (account_id, role, name, email, state_code, seller_id)
import type { AuthUser } from "@/data/types";

export const AUTH_USERS: AuthUser[] = [
  {
    accountId: "acc-1",
    role: "SELLER",
    name: "Darling Mobiles",
    email: "seller@faazio.dev",
    password: "demo1234",
    stateCode: "MH",
    sellerId: "sel-1",
  },
  {
    accountId: "acc-2",
    role: "STATE_ADMIN",
    name: "Anita Deshmukh",
    email: "admin.mh@faazio.dev",
    password: "demo1234",
    stateCode: "MH",
  },
  {
    accountId: "acc-3",
    role: "SUPER_ADMIN",
    name: "Faazio Control",
    email: "super@faazio.dev",
    password: "demo1234",
  },
];
