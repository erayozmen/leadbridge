import "server-only";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DeviceError, type DeviceErrorCode } from "@/features/devices/services/device-errors";
import { captureTechnicalException } from "@/lib/monitoring/capture";

const MAX_BODY_BYTES = 4 * 1024;
const INVALID_BODY = Symbol("INVALID_BODY");

const DEVICE_ERROR_STATUS: Record<DeviceErrorCode, number> = {
  INVALID_PAIRING_CODE: 401,
  SERIAL_NUMBER_IN_USE: 409,
  DEVICE_DISABLED: 403,
  DEVICE_NOT_FOUND: 404,
  DEVICE_NAME_IN_USE: 409,
  DEVICE_STATE_CONFLICT: 409,
};

/** JSON response that is never cached; device responses may carry credentials. */
export function deviceJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Reads a small JSON body; returns INVALID_BODY for oversized or malformed payloads. */
export async function readDeviceJson(request: Request): Promise<unknown | typeof INVALID_BODY> {
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return INVALID_BODY;
    return JSON.parse(text) as unknown;
  } catch {
    return INVALID_BODY;
  }
}

export function isInvalidDeviceBody(body: unknown): body is typeof INVALID_BODY {
  return body === INVALID_BODY;
}

/** Maps known failures to stable API errors; unexpected ones are reported without request data. */
export function deviceErrorResponse(error: unknown, operation: string) {
  if (error instanceof ZodError) return deviceJson({ error: "INVALID_REQUEST" }, 400);
  if (error instanceof DeviceError) return deviceJson({ error: error.code }, DEVICE_ERROR_STATUS[error.code]);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return deviceJson({ error: "SERIAL_NUMBER_IN_USE" }, 409);
  }
  captureTechnicalException(error, { feature: "devices", operation });
  return deviceJson({ error: "INTERNAL_ERROR" }, 500);
}
