import { randomBytes } from "node:crypto";

export function generateQrToken(): string {
  return randomBytes(32).toString("base64url");
}
