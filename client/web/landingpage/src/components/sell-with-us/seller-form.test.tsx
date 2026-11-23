import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The enquiry form is the one place a public visitor can create a merchant record, so its gates are
 * contracts: a location must be pinned, at least one shop photo must be uploaded, the platform fee is
 * mandatory and category-aware, and the honeypot stays invisible. The picker is stubbed (Google Maps
 * cannot load in jsdom) with a control that emulates a pin, and the photo upload is stubbed so the
 * form's own wiring — mirror fields, payload, success state — is what runs here.
 */

const submitSellerInquiry = vi.fn();

const uploadShopPhoto = vi.fn();

vi.mock("@/lib/inquiries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/inquiries")>();
  return {
    ...actual,
    submitSellerInquiry: (...args: unknown[]) => submitSellerInquiry(...args),
    uploadShopPhoto: (...args: unknown[]) => uploadShopPhoto(...args),
  };
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

/** Uploads one stubbed shop photo through the field's real file input. */
async function addPhoto() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("photo input missing");
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "shop.jpg", { type: "image/jpeg" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(uploadShopPhoto).toHaveBeenCalled());
}

describe("SellerForm", () => {
  beforeEach(() => {
    submitSellerInquiry.mockReset();
    submitSellerInquiry.mockResolvedValue({ ok: true, sellerId: "sel-abc123" });
    uploadShopPhoto.mockReset();
    uploadShopPhoto.mockResolvedValue({
      ok: true,
      photo: { assetId: "img_shop1", key: "media/aa/shop.avif", url: "https://cdn/shop.avif" },
    });
    // jsdom has no canvas or createImageBitmap; the downscale is the browser's job, not the form's.
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1200, height: 900, close: () => undefined })),
    );
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/jpeg;base64,/9j/4AAQSkZJRg==");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
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
    await addPhoto();
    pin();
    send();

    expect(await screen.findByText(/Enter your expected platform fee/i)).toBeInTheDocument();
    expect(submitSellerInquiry).not.toHaveBeenCalled();
  });

  it("requires at least one shop photo", async () => {
    render(<SellerForm />);

    fillRequired();
    type("Platform fee (%)", "10");
    pin();
    send();

    expect(await screen.findByText(/Add at least one photo of your shop/i)).toBeInTheDocument();
    expect(submitSellerInquiry).not.toHaveBeenCalled();
  });

  it("enforces the 5% floor for food sellers", async () => {
    render(<SellerForm />);

    fillRequired();
    fireEvent.change(screen.getByLabelText("What do you sell?"), { target: { value: "FOOD" } });
    type("Platform fee (%)", "4");
    await addPhoto();
    pin();
    send();

    expect(await screen.findByText(/minimum 5%/i)).toBeInTheDocument();
    expect(submitSellerInquiry).not.toHaveBeenCalled();
  });

  it("submits the pinned location, resolved fields and fee, then shows the reference", async () => {
    render(<SellerForm />);

    fillRequired();
    type("Platform fee (%)", "10");
    await addPhoto();
    pin();
    send();

    await waitFor(() => expect(submitSellerInquiry).toHaveBeenCalledTimes(1));
    const { data } = submitSellerInquiry.mock.calls[0]![0] as { data: Record<string, unknown> };
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
      shopPhotos: [{ assetId: "img_shop1", key: "media/aa/shop.avif" }],
    });

    expect(await screen.findByText("Enquiry received")).toBeInTheDocument();
    expect(screen.getByText("sel-abc123")).toBeInTheDocument();
  });

  it("shows the server error and keeps the form on failure", async () => {
    submitSellerInquiry.mockResolvedValue({ ok: false, message: "Some details didn't look right." });
    render(<SellerForm />);

    fillRequired();
    type("Platform fee (%)", "10");
    await addPhoto();
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
