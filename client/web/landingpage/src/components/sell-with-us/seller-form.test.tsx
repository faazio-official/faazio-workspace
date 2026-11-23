import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The enquiry form is the one place a public visitor can create a lead, so its gates are contracts:
 * a location must be pinned, the platform fee is mandatory and category-aware, and the honeypot stays
 * invisible. The picker is stubbed (Google Maps cannot load in jsdom) with a control that emulates a
 * pin, so the form's own wiring — mirror fields, payload, success state — is what runs here.
 */

const submitSellerLead = vi.fn();

vi.mock("@/lib/leads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/leads")>();
  return { ...actual, submitSellerLead: (...args: unknown[]) => submitSellerLead(...args) };
});

vi.mock("@/lib/google-maps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/google-maps")>();
  return { ...actual, mapsKey: () => "test-key" };
});

vi.mock("@/components/sell-with-us/map-location-picker", () => ({
  MapLocationPicker: ({
    onChange,
  }: {
    onChange: (next: {
      latitude: number;
      longitude: number;
      address: string;
      stateName: string;
      districtName: string;
      districtPlaceId: string;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          latitude: 10.9254,
          longitude: 79.838,
          address: "12 Bharathiar Street, Karaikal",
          stateName: "Puducherry",
          districtName: "Karaikal",
          districtPlaceId: "ChIJkaraikal",
        })
      }
    >
      Pin my shop
    </button>
  ),
}));

import { SellerForm } from "@/components/sell-with-us/seller-form";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillRequired() {
  type("Business name", "Karaikal Spice Mart");
  type("Owner name", "Ravi Kumar");
  type("Contact phone", "9876543210");
  type("Contact email", "ravi@example.com");
}

function pin() {
  fireEvent.click(screen.getByRole("button", { name: "Pin my shop" }));
}

function send() {
  fireEvent.click(screen.getByRole("button", { name: "Send my enquiry" }));
}

describe("SellerForm", () => {
  beforeEach(() => {
    submitSellerLead.mockReset();
    submitSellerLead.mockResolvedValue({ ok: true, leadId: "lead-abc123" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps submit disabled until a location is pinned", async () => {
    render(<SellerForm />);

    const submit = screen.getByRole("button", { name: "Send my enquiry" });
    expect(submit).toBeDisabled();

    pin();
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("requires a platform fee before it will submit", async () => {
    render(<SellerForm />);

    fillRequired();
    pin();
    send();

    expect(await screen.findByText(/Enter your expected platform fee/i)).toBeInTheDocument();
    expect(submitSellerLead).not.toHaveBeenCalled();
  });

  it("enforces the 5% floor for food sellers", async () => {
    render(<SellerForm />);

    fillRequired();
    fireEvent.change(screen.getByLabelText("What do you sell?"), { target: { value: "FOOD" } });
    type("Platform fee (%)", "4");
    pin();
    send();

    expect(await screen.findByText(/minimum 5%/i)).toBeInTheDocument();
    expect(submitSellerLead).not.toHaveBeenCalled();
  });

  it("submits the pinned location, resolved fields and fee, then shows the reference", async () => {
    render(<SellerForm />);

    fillRequired();
    type("Platform fee (%)", "10");
    pin();
    send();

    await waitFor(() => expect(submitSellerLead).toHaveBeenCalledTimes(1));
    const { data } = submitSellerLead.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data).toMatchObject({
      businessName: "Karaikal Spice Mart",
      ownerName: "Ravi Kumar",
      category: "MART",
      contactPhone: "9876543210",
      contactEmail: "ravi@example.com",
      platformFeePct: 10,
      districtName: "Karaikal",
      stateName: "Puducherry",
      districtPlaceId: "ChIJkaraikal",
      businessAddress: "12 Bharathiar Street, Karaikal",
      latitude: 10.9254,
      longitude: 79.838,
    });

    expect(await screen.findByText("Enquiry received")).toBeInTheDocument();
    expect(screen.getByText("lead-abc123")).toBeInTheDocument();
  });

  it("shows the server error and keeps the form on failure", async () => {
    submitSellerLead.mockResolvedValue({ ok: false, message: "Some details didn't look right." });
    render(<SellerForm />);

    fillRequired();
    type("Platform fee (%)", "10");
    pin();
    send();

    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't look right/i);
    expect(screen.queryByText("Enquiry received")).not.toBeInTheDocument();
  });

  it("keeps the honeypot out of the accessibility tree", () => {
    render(<SellerForm />);
    // The field exists in the DOM but is hidden from assistive tech, so a screen reader never offers it.
    const honeypot = document.querySelector(".sell-honeypot");
    expect(honeypot).toBeTruthy();
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
  });
});
