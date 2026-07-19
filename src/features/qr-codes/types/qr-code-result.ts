export type GenerateQrCodesResult =
  | {
      ok: true;
      count: number;
      firstSerialNumber: string;
      lastSerialNumber: string;
      csv: string;
      rows: Array<{ serialNumber: string; registrationUrl: string }>;
    }
  | {
      ok: false;
      code: "INVALID_INPUT" | "UNAUTHORIZED" | "CONFIG_MISSING" | "SERIAL_CONFLICT" | "CREATE_FAILED";
      message: string;
      fieldErrors?: { quantity?: string[] };
    };

export type DisableQrCodeResult =
  | { ok: true; message: string }
  | { ok: false; code: "UNAUTHORIZED" | "NOT_ALLOWED" | "UPDATE_FAILED"; message: string };

export type ArchiveQrCodeResult =
  | { ok: true; archivedCount: number; message: string }
  | { ok: false; code: "INVALID_INPUT" | "UNAUTHORIZED" | "QR_NOT_FOUND" | "QR_NOT_ARCHIVABLE" | "ARCHIVE_CONFLICT" | "ARCHIVE_FAILED"; message: string };
