import { beforeEach, describe, expect, it, vi } from "vitest";

// hoisted() so the module mocks below can reference the same backing state + spies.
const h = vi.hoisted(() => {
  const state: { products: unknown[] } = { products: [] };
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === "function"
        ? (updater as (s: typeof state) => Partial<typeof state>)(state)
        : (updater as Partial<typeof state>);
    Object.assign(state, patch);
  });
  return { state, set, fetchSellerPricing: vi.fn() };
});

vi.mock("@/lib/config", () => ({
  remoteConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/api/http", () => ({
  ApiError: class ApiError extends Error {},
  remote: { get: vi.fn() },
  toCamel: (v: unknown) => v,
}));

vi.mock("@/lib/api", () => ({
  fetchSellerPricing: h.fetchSellerPricing,
  fetchSellerInventory: vi.fn(),
  fetchSellerStores: vi.fn(),
  fetchNotificationPreferences: vi.fn(),
  fetchSubUsers: vi.fn(),
}));

vi.mock("@/lib/api/store", () => ({
  usePortalStore: { getState: () => ({ ...h.state, set: h.set }) },
}));

import { remoteConfigured } from "@/lib/config";
import { refreshSellerProducts } from "@/lib/api/sync";
import type { SellerConsoleRow } from "@/lib/api";

function row(overrides: Partial<SellerConsoleRow> = {}): SellerConsoleRow {
  return {
    id: "prod-1",
    name: "Test Product",
    app: "MART",
    category: "Snacks",
    status: "ACTIVE",
    sellerId: "sel-1",
    storeId: "store-1",
    price: 199,
    updatedAt: "2026-01-01T00:00:00Z",
    isVeg: true,
    isPrescription: false,
    inStockQty: 5,
    available: true,
    ...overrides,
  };
}

beforeEach(() => {
  h.state.products = [];
  h.set.mockClear();
  h.fetchSellerPricing.mockReset();
  vi.mocked(remoteConfigured).mockReturnValue(true);
});

describe("refreshSellerProducts", () => {
  it("maps gateway rows into the products slice and returns them", async () => {
    h.fetchSellerPricing.mockResolvedValue([row()]);

    const rows = await refreshSellerProducts();

    expect(h.fetchSellerPricing).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.productId).toBe("prod-1");
    // rupees -> paisa on the boundary.
    expect(rows[0]!.pricePaisa).toBe(19900);
    expect(h.state.products).toEqual(rows);
  });

  it("keeps the last-loaded rows and rejects when the gateway fails", async () => {
    h.state.products = [row({ id: "old" })];
    h.fetchSellerPricing.mockRejectedValue(new Error("boom"));

    await expect(refreshSellerProducts()).rejects.toThrow("boom");
    expect(h.set).not.toHaveBeenCalled();
    expect(h.state.products).toEqual([row({ id: "old" })]);
  });

  it("is a no-op returning the current slice when the gateway is unconfigured", async () => {
    vi.mocked(remoteConfigured).mockReturnValue(false);
    h.state.products = [{ productId: "kept" }];

    const rows = await refreshSellerProducts();

    expect(h.fetchSellerPricing).not.toHaveBeenCalled();
    expect(h.set).not.toHaveBeenCalled();
    expect(rows[0]!.productId).toBe("kept");
  });
});
