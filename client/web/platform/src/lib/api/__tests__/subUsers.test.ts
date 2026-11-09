import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: { session: unknown; subUsers: unknown[]; auditLogs: unknown[] } = {
    session: { sellerId: "sel-1" },
    subUsers: [],
    auditLogs: [],
  };
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === "function"
        ? (updater as (s: typeof state) => Partial<typeof state>)(state)
        : (updater as Partial<typeof state>);
    Object.assign(state, patch);
  });
  return { state, set, remotePost: vi.fn() };
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

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));

vi.mock("@/lib/api/store", () => ({
  usePortalStore: { getState: () => ({ ...h.state, set: h.set }) },
}));

import { remoteConfigured } from "@/lib/config";
import { inviteSubUser, resendSubUserInvite } from "@/lib/api/index";

const invite = {
  subUserId: "sub-1",
  sellerId: "sel-1",
  name: "Staff One",
  email: "staff@example.com",
  role: "STAFF",
  status: "PENDING_INVITE",
  createdAt: "2026-01-01T00:00:00Z",
  inviteToken: "tok-1",
  inviteExpiresAt: "2026-01-08T00:00:00Z",
};

beforeEach(() => {
  h.state.session = { sellerId: "sel-1" };
  h.state.subUsers = [];
  h.state.auditLogs = [];
  h.set.mockClear();
  h.remotePost.mockReset();
  vi.mocked(remoteConfigured).mockReturnValue(true);
});

describe("inviteSubUser", () => {
  it("posts to the gateway and returns the one-time accept token", async () => {
    h.remotePost.mockResolvedValue(invite);

    const result = await inviteSubUser("sel-1", {
      name: "Staff One",
      email: "staff@example.com",
      role: "STAFF",
    });

    expect(result.inviteToken).toBe("tok-1");
    const [path, body] = h.remotePost.mock.calls[0]!;
    expect(path).toBe("/seller/sub-users");
    expect(body).toMatchObject({ name: "Staff One", email: "staff@example.com", role: "STAFF" });
    expect(h.state.subUsers[0]).toMatchObject({ subUserId: "sub-1" });
  });

  it("rejects offline instead of fabricating a link", async () => {
    vi.mocked(remoteConfigured).mockReturnValue(false);
    await expect(
      inviteSubUser("sel-1", { name: "A", email: "a@b.com", role: "STAFF" }),
    ).rejects.toThrow(/not configured/i);
    expect(h.remotePost).not.toHaveBeenCalled();
  });
});

describe("resendSubUserInvite", () => {
  it("rotates the link via the resend endpoint and refreshes the local row", async () => {
    h.state.subUsers = [invite];
    h.remotePost.mockResolvedValue({ ...invite, inviteToken: "tok-2" });

    const result = await resendSubUserInvite("sel-1", "sub-1");

    expect(result.inviteToken).toBe("tok-2");
    expect(h.remotePost.mock.calls[0]![0]).toBe("/seller/sub-users/sub-1/resend");
    expect((h.state.subUsers[0] as { inviteToken?: string }).inviteToken).toBe("tok-2");
  });
});
