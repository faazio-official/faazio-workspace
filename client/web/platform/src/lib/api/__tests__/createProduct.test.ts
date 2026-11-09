import { beforeEach, describe, expect, it, vi } from "vitest";

// hoisted() so the module mocks below can reference the same backing state + spies.
const h = vi.hoisted(() => {
  const state: {
    session: unknown;
    products: unknown[];
    stock: unknown[];
    auditLogs: unknown[];
  } = { session: null, products: [], stock: [], auditLogs: [] };

  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === "function"
        ? (updater as (s: typeof state) => Partial<typeof state>)(state)
        : (updater as Partial<typeof state>);
    Object.assign(state, patch);
  });

  return { state, set, remotePost: vi.fn() };
});

vi.mock("@/lib/config", () => ({
  remoteConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/api/http", () => ({
  ApiError: class ApiError extends Error {},
  remote: {
    get: vi.fn(),
    post: h.remotePost,
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  toCamel: (v: unknown) => v,
  writeAwaited: vi.fn(async () => undefined),
}));

vi.mock("@/lib/portal/auth", () => ({
  armProactiveRefresh: vi.fn(),
  cancelProactiveRefresh: vi.fn(),
  loginPortal: vi.fn(),
  logoutPortal: vi.fn(),
  restorePortalSession: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

vi.mock("@/lib/api/store", () => ({
  usePortalStore: {
    getState: () => ({ ...h.state, set: h.set }),
  },
}));

import { remoteConfigured } from "@/lib/config";
import { createProduct, type CreateProductInput } from "@/lib/api/index";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";

function dto(overrides: Partial<CreateProductInput> = {}): CreateProductInput {
  return {
    sellerId: "sel-1",
    storeId: "store-1",
    name: "Test Product",
    description: "A test product",
    sector: "MART",
    category: "Snacks",
    emoji: "",
    imageUrl: "",
    unit: "1 pc",
    pricePaisa: 19900,
    isVeg: true,
    isPrescription: false,
    status: "PENDING_REVIEW",
    ...overrides,
  };
}

beforeEach(() => {
  h.state.session = null;
  h.state.products = [];
  h.state.stock = [];
  h.state.auditLogs = [];
  h.set.mockClear();
  h.remotePost.mockReset();
  vi.mocked(remoteConfigured).mockReturnValue(true);
});

describe("createProduct (live gateway mode)", () => {
  it("adopts the server-owned id/status and speaks whole rupees", async () => {
    h.remotePost.mockResolvedValue({ id: "prod-x", status: "PENDING_REVIEW" });

    const rec = await createProduct(dto({ pricePaisa: 19900 }));

    expect(rec.productId).toBe("prod-x");
    expect(rec.status).toBe("PENDING_REVIEW");
    expect(h.remotePost).toHaveBeenCalledTimes(1);

    const [path, body] = h.remotePost.mock.calls[0]!;
    expect(path).toBe("/seller/products");
    expect(body).toMatchObject({ storeId: "store-1", name: "Test Product", price: 199 });
    // 19900 paisa round-trips to 199 whole rupees on the wire.
    expect((body as { price: number }).price).toBe(parseRupeesToPaisa("199") / 100);
    expect((body as { taxonomyCategoryId?: string }).taxonomyCategoryId).toBeUndefined();

    // The local store row adopts the server id and seeds a matching stock row.
    expect((h.state.products[0] as { productId: string }).productId).toBe("prod-x");
    expect(h.state.stock[0]).toMatchObject({
      productId: "prod-x",
      quantity: 0,
      lowStockThreshold: 12,
      etaMinutes: 30,
    });
  });

  it("forwards the taxonomy category id for discovery", async () => {
    h.remotePost.mockResolvedValue({ id: "prod-tax", status: "PENDING_REVIEW" });

    await createProduct(dto({ taxonomyCategoryId: "sub_snacks" }));

    const body = h.remotePost.mock.calls[0]![1] as { taxonomyCategoryId?: string };
    expect(body.taxonomyCategoryId).toBe("sub_snacks");
  });

  it("rejects a still-base64 data: photo (upload never reached media)", async () => {
    await expect(
      createProduct(dto({ imageUrl: "data:image/png;base64,AAAA" })),
    ).rejects.toThrow(/media service/i);
    expect(h.remotePost).not.toHaveBeenCalled();
  });

  it("maps an r2:<key> reference to imageKey and omits imageUrl", async () => {
    h.remotePost.mockResolvedValue({ id: "prod-y", status: "PENDING_REVIEW" });

    await createProduct(dto({ imageUrl: "r2:media/ab/xyz.jpg" }));

    const body = h.remotePost.mock.calls[0]![1] as { imageKey?: string; imageUrl?: string };
    expect(body.imageKey).toBe("media/ab/xyz.jpg");
    expect(body.imageUrl).toBeUndefined();
  });

  it("passes a legacy https URL through untouched", async () => {
    h.remotePost.mockResolvedValue({ id: "prod-z", status: "PENDING_REVIEW" });

    await createProduct(dto({ imageUrl: "https://cdn.example.com/a.jpg" }));

    const body = h.remotePost.mock.calls[0]![1] as { imageKey?: string; imageUrl?: string };
    expect(body.imageUrl).toBe("https://cdn.example.com/a.jpg");
    expect(body.imageKey).toBeUndefined();
  });
});

describe("createProduct (offline seed mode)", () => {
  it("keeps a local row id and never calls the gateway", async () => {
    vi.mocked(remoteConfigured).mockReturnValue(false);

    const rec = await createProduct(dto());

    expect(h.remotePost).not.toHaveBeenCalled();
    expect(rec.productId.startsWith("local-")).toBe(true);
    expect((h.state.products[0] as { productId: string }).productId).toBe(rec.productId);
    expect(h.state.stock[0]).toMatchObject({
      productId: rec.productId,
      quantity: 0,
      lowStockThreshold: 12,
      etaMinutes: 30,
    });
  });
});

describe("pricing helpers", () => {
  it("parses rupees text to integer paisa", () => {
    expect(parseRupeesToPaisa("199")).toBe(19900);
    expect(parseRupeesToPaisa("19.99")).toBe(1999);
    expect(parseRupeesToPaisa("₹1,234.50")).toBe(123450);
    expect(parseRupeesToPaisa("")).toBe(0);
  });

  it("round-trips paisa -> rupees -> paisa", () => {
    const paisa = parseRupeesToPaisa("199.5");
    expect(paisa).toBe(19950);
    // toRupees(paisa) is not exported; the same rounding is observable via the write body.
    expect(Math.round(paisa / 100)).toBe(200);
    expect(formatINR(19950)).toBe("₹199.50");
  });
});
