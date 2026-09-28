import {
  deviceErrorResponse,
  deviceJson,
  isInvalidDeviceBody,
  readDeviceJson,
} from "@/features/devices/server/device-route-helpers";
import { pairDevice } from "@/features/devices/services/pair-device";
import { resolveTrustedClientIdentity } from "@/lib/security/client-identity";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const PAIR_RATE_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };

export async function POST(request: Request) {
  const identity = resolveTrustedClientIdentity(request.headers) ?? "anonymous";
  if (!consumeRateLimit(`device-pair:${identity}`, PAIR_RATE_LIMIT)) {
    return deviceJson({ error: "RATE_LIMITED" }, 429);
  }

  const body = await readDeviceJson(request);
  if (isInvalidDeviceBody(body)) return deviceJson({ error: "INVALID_REQUEST" }, 400);

  try {
    return deviceJson(await pairDevice(body));
  } catch (error) {
    return deviceErrorResponse(error, "pair");
  }
}
