import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./cinematic-login.tsx", import.meta.url), "utf8");
const legacyLogo = ["leadbridges-logo", "svg"].join(".");

describe("cinematic login experience contract", () => {
  it("uses only the canonical PNG logo", () => {
    expect(source).toContain('src="/brand/leadbridges-logo.png"');
    expect(source.match(/leadbridges-logo\.png/g)).toHaveLength(1);
    expect(source).not.toContain(legacyLogo);
    expect(source).toContain('alt=""');
  });

  it("keeps the video decorative, inline, muted, and non-looping", () => {
    expect(source).toContain('src="/brand/leadbridges-intro.mp4"');
    expect(source).toMatch(/muted playsInline autoPlay/);
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toMatch(/\sloop(?:\s|=|>)/);
  });

  it("keeps the existing login form and an accessible skip control", () => {
    expect(source).toContain("<LoginForm />");
    expect(source).toContain('aria-label="Sinematik tanıtımı atla"');
    expect(source).toContain("onError={finishIntro}");
  });
});
