import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HiOutlineCheckCircle, HiOutlineMapPin } from "react-icons/hi2";
import { leadSchema, submitSellerLead, type LeadInput } from "@/lib/leads";
import { mapsKey } from "@/lib/google-maps";
import {
  MapLocationPicker,
  type PickedLocation,
} from "@/components/sell-with-us/map-location-picker";

const CATEGORIES = [
  { value: "MART", label: "Grocery / Mart" },
  { value: "FOOD", label: "Restaurant / Food" },
  { value: "PHARMA", label: "Pharmacy / Medical" },
] as const;

const CENTRE = { lat: 10.9254, lng: 79.838 };

type Submitted = { leadId: string | null } | null;

/**
 * The public "Sell with us" enquiry form. It collects what a first conversation needs — who you are,
 * what you sell, where the shop is — and never asks for PAN, bank details, a passbook or an OTP.
 * Those belong to the KYC-complete application in the mobile app, which is where an approved lead
 * continues. Submitting here creates a lead (`sellers.seller_leads`), not an account.
 */
export function SellerForm() {
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [locationError, setLocationError] = useState("");
  const [submitted, setSubmitted] = useState<Submitted>(null);
  const [serverError, setServerError] = useState("");
  const [mapAvailable, setMapAvailable] = useState(Boolean(mapsKey()));

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      businessName: "",
      ownerName: "",
      category: "MART",
      contactPhone: "",
      contactEmail: "",
      districtName: "",
      notes: "",
      website: "",
    },
  });

  const onSubmit = async (values: LeadInput) => {
    setServerError("");
    const result = await submitSellerLead({
      data: {
        ...values,
        latitude: location?.latitude,
        longitude: location?.longitude,
      },
    });
    if (!result.ok) {
      setServerError(result.message);
      return;
    }
    setSubmitted({ leadId: result.leadId });
    reset();
    setLocation(null);
  };

  if (submitted) {
    return (
      <div className="sell-done" role="status">
        <HiOutlineCheckCircle aria-hidden="true" className="sell-done-icon" />
        <h2>Enquiry received</h2>
        <p>
          Thank you — we have your details. Our partner team will call the number you gave us to
          talk through the next step: the full application happens in the Faazio app.
        </p>
        <div className="action-row">
          <a href="/download" className="btn btn-primary">
            Get the Faazio app
          </a>
          <a href="/seller-terms" className="btn btn-outline">
            Read the seller terms
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className="sell-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={mapAvailable ? "sell-grid" : "sell-grid sell-grid-solo"}>
        <div className="sell-fields">
          <div className="field-row">
            <div className="field">
              <label htmlFor="businessName">Business name</label>
              <input
                id="businessName"
                type="text"
                autoComplete="organization"
                aria-invalid={errors.businessName ? "true" : undefined}
                {...register("businessName")}
              />
              {errors.businessName ? (
                <p className="field-error">{errors.businessName.message}</p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="ownerName">Owner name</label>
              <input
                id="ownerName"
                type="text"
                autoComplete="name"
                aria-invalid={errors.ownerName ? "true" : undefined}
                {...register("ownerName")}
              />
              {errors.ownerName ? <p className="field-error">{errors.ownerName.message}</p> : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="category">What do you sell?</label>
            <select id="category" {...register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.category ? <p className="field-error">{errors.category.message}</p> : null}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="contactPhone">Contact phone</label>
              <input
                id="contactPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                aria-invalid={errors.contactPhone ? "true" : undefined}
                {...register("contactPhone")}
              />
              {errors.contactPhone ? (
                <p className="field-error">{errors.contactPhone.message}</p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="contactEmail">Contact email</label>
              <input
                id="contactEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-invalid={errors.contactEmail ? "true" : undefined}
                {...register("contactEmail")}
              />
              {errors.contactEmail ? (
                <p className="field-error">{errors.contactEmail.message}</p>
              ) : null}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="businessAddress">Shop address</label>
              <input
                id="businessAddress"
                type="text"
                autoComplete="street-address"
                placeholder="Street, landmark, town"
                aria-invalid={errors.businessAddress ? "true" : undefined}
                {...register("businessAddress")}
              />
              {errors.businessAddress ? (
                <p className="field-error">{errors.businessAddress.message}</p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="districtName">District</label>
              <input
                id="districtName"
                type="text"
                placeholder="e.g. Karaikal"
                aria-invalid={errors.districtName ? "true" : undefined}
                {...register("districtName")}
              />
              {errors.districtName ? (
                <p className="field-error">{errors.districtName.message}</p>
              ) : null}
            </div>
          </div>
          <p className="field-hint">
            {location?.address
              ? "Filled from the map pin. Edit it if the pin landed slightly off."
              : mapAvailable
                ? "Type the address and district, or drop a pin on the map to fill them in."
                : "Type the address and district — they are all we need to find your shop."}
          </p>

          <div className="field">
            <label htmlFor="notes">Anything we should know? (optional)</label>
            <textarea id="notes" rows={3} maxLength={500} {...register("notes")} />
            {errors.notes ? <p className="field-error">{errors.notes.message}</p> : null}
          </div>

          {/* Honeypot: off-screen and hidden from assistive tech; a person never fills it. */}
          <div className="sell-honeypot" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...register("website")}
            />
          </div>

          <button type="submit" className="btn btn-primary sell-submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send my enquiry"}
          </button>
          {serverError ? (
            <p className="field-error" role="alert">
              {serverError}
            </p>
          ) : null}
          <p className="sell-consent">
            By sending this, you agree to be contacted about selling on Faazio and accept the{" "}
            <a href="/seller-terms">Seller &amp; Partner Terms</a> and{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>

        {mapAvailable ? (
          <div className="sell-map">
            <MapLocationPicker
              centre={CENTRE}
              value={location}
              onChange={(next) => {
                setLocationError("");
                setLocation(next);
                if (next.address) setValue("businessAddress", next.address, { shouldDirty: true });
                if (next.districtName)
                  setValue("districtName", next.districtName, { shouldDirty: true });
                if (next.stateName) setValue("stateName", next.stateName);
              }}
              onAddressError={(message) => setLocationError(message)}
              onUnavailable={() => {
                setMapAvailable(false);
                setLocation(null);
                setLocationError(
                  "The map isn't available right now — type your address and district instead.",
                );
              }}
            />
            {location?.districtName ? (
              <p className="map-picker-district">
                <HiOutlineMapPin aria-hidden="true" /> {location.districtName}
                {location.stateName ? `, ${location.stateName}` : ""}
              </p>
            ) : null}
            {locationError ? (
              <p className="field-error" role="alert">
                {locationError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
