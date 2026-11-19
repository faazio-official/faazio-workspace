import { describe, expect, it } from "vitest";
import { isTamilText, tamilFieldError } from "@/lib/tamil";

describe("Tamil field validation", () => {
  it("accepts Tamil script copy", () => {
    expect(isTamilText("தமிழ்")).toBe(true);
    expect(isTamilText("பால் பொடி 500 கிராம்")).toBe(true);
    expect(isTamilText("சோப்பு (100) - 5%")).toBe(true);
  });

  it("rejects Latin and mixed scripts", () => {
    expect(isTamilText("Milk")).toBe(false);
    expect(isTamilText("பால் Milk")).toBe(false);
    expect(isTamilText("हिंदी")).toBe(false);
  });

  it("allows an empty value as 'not translated yet'", () => {
    expect(tamilFieldError("", 200)).toBeNull();
    expect(tamilFieldError("   ", 200)).toBeNull();
  });

  it("reports a script error before a length error only when text is non-Tamil", () => {
    expect(tamilFieldError("Milk", 200)).toBe("Tamil text: use Tamil letters only.");
    expect(tamilFieldError("தமிழ்", 3)).toMatch(/characters or fewer/);
  });
});
