import { describe, expect, it, vi } from "vitest";

import { buildQrZip, createQrZipFileName, type QrZipDependencies } from "@/features/qr-codes/lib/build-qr-zip";

function setup(overrides: Partial<QrZipDependencies> = {}) {
  const pngFiles: Array<{ name: string; data: string }> = [];
  const textFiles: Array<{ name: string; data: string }> = [];
  const createPngDataUrl = vi.fn(async (content: string) => `data:image/png;base64,${btoa(content)}`);
  const blob = new Blob(["zip"]);
  const dependencies: QrZipDependencies = {
    createPngDataUrl,
    createZip: () => ({
      addBase64File: (name, data) => pngFiles.push({ name, data }),
      addTextFile: (name, data) => textFiles.push({ name, data }),
      generate: vi.fn(async () => blob),
    }),
    ...overrides,
  };
  return { dependencies, createPngDataUrl, pngFiles, textFiles, blob };
}

const rows = [
  { serialNumber: "LB-000001", registrationUrl: "http://localhost:3000/r/token-one" },
  { serialNumber: "LB-000002", registrationUrl: "http://localhost:3000/r/token-two" },
];

describe("buildQrZip", () => {
  it("creates a PNG from every registration URL", async () => {
    const state = setup(); await buildQrZip(rows, "csv", state.dependencies);
    expect(state.createPngDataUrl).toHaveBeenNthCalledWith(1, rows[0].registrationUrl);
    expect(state.createPngDataUrl).toHaveBeenNthCalledWith(2, rows[1].registrationUrl);
  });
  it("names PNG files with serial numbers", async () => {
    const state = setup(); await buildQrZip(rows, "csv", state.dependencies);
    expect(state.pngFiles.map((file) => file.name)).toEqual(["LB-000001.png", "LB-000002.png"]);
  });
  it("adds every PNG without omissions", async () => {
    const state = setup(); await buildQrZip(rows, "csv", state.dependencies);
    expect(state.pngFiles).toHaveLength(rows.length);
  });
  it("adds the original CSV", async () => {
    const state = setup(); await buildQrZip(rows, "serialNumber,registrationUrl", state.dependencies);
    expect(state.textFiles).toEqual([{ name: "qr-codes.csv", data: "serialNumber,registrationUrl" }]);
  });
  it("returns the generated archive blob", async () => {
    const state = setup(); await expect(buildQrZip(rows, "csv", state.dependencies)).resolves.toBe(state.blob);
  });
  it("does not add a token hash file or field", async () => {
    const state = setup(); await buildQrZip(rows, "csv", state.dependencies);
    expect(JSON.stringify({ png: state.pngFiles, text: state.textFiles })).not.toContain("tokenHash");
  });
  it("rejects duplicate serial file names", async () => {
    const state = setup();
    await expect(buildQrZip([rows[0], rows[0]], "csv", state.dependencies)).rejects.toThrow("Duplicate QR file name");
  });
  it("rejects invalid PNG data without producing an archive", async () => {
    const state = setup({ createPngDataUrl: vi.fn(async () => "invalid") });
    await expect(buildQrZip(rows, "csv", state.dependencies)).rejects.toThrow("QR image could not be generated");
  });
  it("creates a filesystem-safe timestamped filename", () => {
    expect(createQrZipFileName(new Date(2026, 6, 19, 15, 7))).toBe("leadbridge-qr-codes-20260719-1507.zip");
  });
});
