import JSZip from "jszip";
import QRCode from "qrcode";

export type QrZipRow = { serialNumber: string; registrationUrl: string };
type ZipWriter = {
  addBase64File: (name: string, data: string) => void;
  addTextFile: (name: string, data: string) => void;
  generate: () => Promise<Blob>;
};
export type QrZipDependencies = {
  createPngDataUrl: (content: string) => Promise<string>;
  createZip: () => ZipWriter;
};

export function createQrZipFileName(now = new Date()): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");
  return `leadbridge-qr-codes-${stamp}.zip`;
}

function defaultDependencies(): QrZipDependencies {
  return {
    createPngDataUrl: (content) =>
      QRCode.toDataURL(content, {
        width: 768,
        margin: 4,
        errorCorrectionLevel: "Q",
        color: { dark: "#000000", light: "#ffffff" },
      }),
    createZip() {
      const zip = new JSZip();
      return {
        addBase64File: (name, data) => zip.file(name, data, { base64: true }),
        addTextFile: (name, data) => zip.file(name, data),
        generate: () => zip.generateAsync({ type: "blob", compression: "DEFLATE" }),
      };
    },
  };
}

export async function buildQrZip(
  rows: QrZipRow[],
  csv: string,
  dependencies: QrZipDependencies = defaultDependencies(),
): Promise<Blob> {
  const zip = dependencies.createZip();
  const names = new Set<string>();

  for (const row of rows) {
    const fileName = `${row.serialNumber}.png`;
    if (names.has(fileName)) throw new Error("Duplicate QR file name");
    names.add(fileName);
    const dataUrl = await dependencies.createPngDataUrl(row.registrationUrl);
    const base64 = dataUrl.split(",", 2)[1];
    if (!base64) throw new Error("QR image could not be generated");
    zip.addBase64File(fileName, base64);
  }

  zip.addTextFile("qr-codes.csv", csv);
  return zip.generate();
}
