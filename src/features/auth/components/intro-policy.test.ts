import { describe, expect, it } from "vitest";
import { chooseIntroMode, getLogoRevealDelay } from "./intro-policy";

describe("cinematic login intro policy", () => {
  it("plays the full intro on the first desktop session visit", () => {
    expect(chooseIntroMode({ reducedMotion: false, compactViewport: false, seenInSession: false })).toBe("full");
  });
  it("uses a short reveal on repeat visits and compact screens", () => {
    expect(chooseIntroMode({ reducedMotion: false, compactViewport: false, seenInSession: true })).toBe("short");
    expect(chooseIntroMode({ reducedMotion: false, compactViewport: true, seenInSession: false })).toBe("short");
  });
  it("bypasses motion when the user requests reduced motion", () => {
    expect(chooseIntroMode({ reducedMotion: true, compactViewport: false, seenInSession: false })).toBe("static");
  });
  it("derives the reveal from metadata and safely falls back", () => {
    expect(getLogoRevealDelay(7)).toBe(6_000);
    expect(getLogoRevealDelay(Number.NaN)).toBe(5_400);
  });
});
