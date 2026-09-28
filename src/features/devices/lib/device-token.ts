import { createHash, randomBytes, randomInt } from "node:crypto";

// Crockford base32: no I, L, O or U, so codes survive being read aloud or typed in a headset.
const PAIRING_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PAIRING_CODE_LENGTH = 12;
const PAIRING_CODE_GROUP = 4;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PAIRING_CODE_PATTERN = new RegExp(`^[${PAIRING_CODE_ALPHABET}]{${PAIRING_CODE_LENGTH}}$`);

export const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;

export function generateDeviceAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generatePairingCode(): string {
  let code = "";
  for (let index = 0; index < PAIRING_CODE_LENGTH; index += 1) {
    code += PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)];
  }
  return code.match(new RegExp(`.{${PAIRING_CODE_GROUP}}`, "g"))!.join("-");
}

/** Returns the canonical form of a user-entered pairing code, or null if it cannot be valid. */
export function normalizePairingCode(input: string): string | null {
  const normalized = input.toUpperCase().replace(/[\s-]/g, "");
  return PAIRING_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Extracts a well-formed device access token from an Authorization header value. */
export function parseDeviceBearerToken(authorization: string | null): string | null {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return token && ACCESS_TOKEN_PATTERN.test(token) ? token : null;
}
