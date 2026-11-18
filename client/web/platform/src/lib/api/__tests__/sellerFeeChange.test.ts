import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: { session: unknown; auditLogs: unknown[] } = {
    session: { sellerId: "sel-1", role: "SELLER" },
    auditLogs: [],
  };
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === "function"
        ? (updater as (s: typeof state) => Partial<typeof state>)(state)
        : (updater as Partial<typeof state>);
    Object.assign(state, patch);
  });
  return { state, set, remoteGet: vi.fn(), remotePost: vi.fn() };
});

vi.mock("@/lib/config", () => ({ remoteConfigured: vi.fn(() => true) }));

vi.mock("@/lib/api/http", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
  remote: {
    get: h.remoteGet,
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

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));

vi.mock("@/lib/api/store", () => ({
  usePortalStore: { getState: () => ({ ...h.state, set: h.set }) },
}));

import { remoteConfigured } from "@/lib/config";
import { listSellerFeeChangeRequests, requestSellerPlatformFeeChange } from "@/lib/api/index";

const request = {
  requestId: "fee-1",
  sellerId: "sel-1",
  storeId: "store-1",
  currentFeePct: 8,
  requestedFeePct: 10,
  status: "PENDING",
  requestedAt: "2026-02-01T10:00:00Z",
};

beforeEach(() => {
  h.state.session = { sellerId: "sel-1", role: "SELLER" };
  h.state.auditLogs = [];
  h.set.mockClear();
  h.remoteGet.mockReset();
  h.remotePost.mockReset();
  vi.mocked(remoteConfigured).mockReturnValue(true);
});

describe("requestSellerPlatformFeeChange", () => {
  it("posts only storeId + platformFeePct + reason to the seller's own endpoint", async () => {
    h.remotePost.mockResolvedValue(request);

    const created = await requestSellerPlatformFeeChange("sel-1", "store-1", 10, "  rent went up  ");

    expect(h.remotePost).toHaveBeenCalledWith("/sellers/sel-1/platform-fee-request", {
      storeId: "store-1",
      platformFeePct: 10,
      reason: "rent went up",
    });
    expect(created.requestId).toBe("fee-1");
    expect(h.state.auditLogs).toHaveLength(1);
  });

  it("sends an empty reason (never undefined) when the seller writes nothing", async () => {
    h.remotePost.mockResolvedValue(request);

    await requestSellerPlatformFeeChange("sel-1", "store-1", 10);

    expect(h.remotePost.mock.calls[0]![1]).toEqual({
      storeId: "store-1",
      platformFeePct: 10,
      reason: "",
    });
  });

  it("percent-encodes the seller id and surfaces a server rejection", async () => {
    h.remotePost.mockRejectedValue(
      new (class extends Error {
        status = 409;
        code = "request_pending";
      })("a fee-change request is already pending"),
    );

    await expect(requestSellerPlatformFeeChange("sel 1", "store-1", 10)).rejects.toThrow(
      "already pending",
    );
    expect(h.remotePost.mock.calls[0]![0]).toBe("/sellers/sel%201/platform-fee-request");
    expect(h.state.auditLogs).toHaveLength(0);
  });

  it("throws instead of faking a result when the gateway is unconfigured", async () => {
    vi.mocked(remoteConfigured).mockReturnValue(false);

    await expect(requestSellerPlatformFeeChange("sel-1", "store-1", 10)).rejects.toThrow(
      "Gateway is not configured",
    );
    expect(h.remotePost).not.toHaveBeenCalled();
  });
});

describe("listSellerFeeChangeRequests", () => {
  it("reads the caller-scoped history endpoint", async () => {
    h.remoteGet.mockResolvedValue([request]);

    const rows = await listSellerFeeChangeRequests("sel-1");

    expect(h.remoteGet).toHaveBeenCalledWith("/sellers/sel-1/platform-fee-requests");
    expect(rows).toEqual([request]);
  });

  it("returns an empty list (never fixtures) when the gateway is unconfigured", async () => {
    vi.mocked(remoteConfigured).mockReturnValue(false);

    expect(await listSellerFeeChangeRequests("sel-1")).toEqual([]);
    expect(h.remoteGet).not.toHaveBeenCalled();
  });
});
