import { describe, expect, it } from "vitest";
import {
  MIN_SUGGESTION_CHARS,
  describePlace,
  fetchSuggestions,
  mapsApiReady,
  resolveSuggestion,
  type MapsApi,
} from "@/lib/google-maps";

/**
 * The address search moved off the retired `places.Autocomplete` widget onto Places API (New)
 * `AutocompleteSuggestion`. Both halves of that swap fail silently in the browser — a short query
 * that still hits the network, or a selection that yields no coordinates — so the contract is pinned
 * here with fake API surfaces.
 */

function fakeApi(overrides: {
  suggestions?: unknown[];
  throwOnFetch?: boolean;
  place?: unknown;
  throwOnPlace?: boolean;
}): MapsApi {
  return {
    Map: class {},
    Marker: class {},
    Geocoder: class {},
    event: { addListener: () => {} },
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: async () => {
        if (overrides.throwOnFetch) throw new Error("quota");
        return { suggestions: overrides.suggestions ?? [] };
      },
    },
    Place: class {
      location = overrides.place
        ? (overrides.place as { location?: { lat(): number; lng(): number } }).location
        : undefined;
      formattedAddress = "12 Main St, Karaikal";
      addressComponents = [
        { longText: "Puducherry", types: ["administrative_area_level_1"] },
        { longText: "Karaikal", types: ["administrative_area_level_2"] },
        { longText: "609602", types: ["postal_code"] },
      ];
      async fetchFields() {
        if (overrides.throwOnPlace) throw new Error("billed call failed");
      }
    },
  } as unknown as MapsApi;
}

function prediction(id: string, main: string, secondary: string) {
  return {
    placePrediction: {
      placeId: id,
      mainText: { toString: () => main },
      secondaryText: { toString: () => secondary },
    },
  };
}

describe("fetchSuggestions", () => {
  it("does not hit the network for a query shorter than the minimum", async () => {
    let called = false;
    const api = fakeApi({});
    (api.AutocompleteSuggestion as unknown as Record<string, unknown>)[
      "fetchAutocompleteSuggestions"
    ] = async () => {
      called = true;
      return { suggestions: [] };
    };

    expect(await fetchSuggestions(api, "a")).toEqual([]);
    expect(await fetchSuggestions(api, "  ")).toEqual([]);
    expect(called).toBe(false);
    expect(MIN_SUGGESTION_CHARS).toBe(2);
  });

  it("flattens predictions into the picker's own shape", async () => {
    const api = fakeApi({ suggestions: [prediction("p1", "Anand Stores", "Karaikal, India")] });
    expect(await fetchSuggestions(api, "anand")).toEqual([
      { placeId: "p1", mainText: "Anand Stores", secondaryText: "Karaikal, India" },
    ]);
  });

  it("drops predictions without a place id instead of emitting a dead option", async () => {
    const api = fakeApi({
      suggestions: [
        { placePrediction: { mainText: { toString: () => "No id" } } },
        prediction("p2", "Good", "Karaikal"),
      ],
    });
    expect(await fetchSuggestions(api, "shop")).toEqual([
      { placeId: "p2", mainText: "Good", secondaryText: "Karaikal" },
    ]);
  });

  it("returns an empty list rather than throwing when Places fails", async () => {
    const api = fakeApi({ throwOnFetch: true });
    await expect(fetchSuggestions(api, "anand")).resolves.toEqual([]);
  });
});

describe("resolveSuggestion", () => {
  it("returns coordinates and a parsed address for a chosen place", async () => {
    const api = fakeApi({
      place: { location: { lat: () => 10.92, lng: () => 79.83 } },
    });
    const resolved = await resolveSuggestion(api, "p1");
    expect(resolved?.point).toEqual({ lat: 10.92, lng: 79.83 });
    expect(resolved?.address.districtName).toBe("Karaikal");
    expect(resolved?.address.stateName).toBe("Puducherry");
  });

  it("returns null when the place carries no location, so the pin is never invented", async () => {
    const api = fakeApi({ place: { location: undefined } });
    expect(await resolveSuggestion(api, "p1")).toBeNull();
  });

  it("returns null rather than throwing when the details call fails", async () => {
    const api = fakeApi({
      place: { location: { lat: () => 1, lng: () => 2 } },
      throwOnPlace: true,
    });
    await expect(resolveSuggestion(api, "p1")).resolves.toBeNull();
  });
});

describe("describePlace", () => {
  it("reads Places API (New) longText components", () => {
    const part = describePlace("12 Main St", [
      { longText: "Puducherry", types: ["administrative_area_level_1"] },
      { longText: "Karaikal", types: ["administrative_area_level_2"] },
      { longText: "609602", types: ["postal_code"] },
    ]);
    expect(part).toEqual({
      formattedAddress: "12 Main St",
      stateName: "Puducherry",
      districtName: "Karaikal",
      postcode: "609602",
    });
  });

  it("still reads legacy Geocoder long_name components", () => {
    const part = describePlace("12 Main St", [
      { long_name: "Puducherry", short_name: "PY", types: ["administrative_area_level_1"] },
      { long_name: "Karaikal", short_name: "K", types: ["administrative_area_level_2"] },
    ]);
    expect(part.stateName).toBe("Puducherry");
    expect(part.districtName).toBe("Karaikal");
  });

  it("never uses the city (locality) as the district", () => {
    const part = describePlace("12 Main St", [
      { longText: "Tiruchirappalli", types: ["locality"] },
      { longText: "Tamil Nadu", types: ["administrative_area_level_1"] },
    ]);
    expect(part.districtName).toBe("");
  });

  it("keeps the sub-district (administrative_area_level_3) when there is no level 2", () => {
    const part = describePlace("12 Main St", [
      { longText: "Lalgudi", types: ["administrative_area_level_3"] },
      { longText: "Tiruchirappalli", types: ["locality"] },
    ]);
    expect(part.districtName).toBe("Lalgudi");
  });
});

describe("mapsApiReady", () => {
  it("rejects a facade missing any required library", () => {
    const full = fakeApi({}) as unknown as Record<string, unknown>;
    expect(mapsApiReady(full as unknown as MapsApi)).toBe(true);
    for (const key of [
      "Map",
      "Marker",
      "Geocoder",
      "AutocompleteSuggestion",
      "AutocompleteSessionToken",
      "Place",
      "event",
    ]) {
      const partial = { ...full };
      delete partial[key];
      expect(mapsApiReady(partial as unknown as MapsApi)).toBe(false);
    }
  });
});
