import { authenticateDevice } from "@/features/devices/server/authenticate-device";
import {
  deviceErrorResponse,
  deviceJson,
  isInvalidDeviceBody,
  readDeviceJson,
} from "@/features/devices/server/device-route-helpers";
import { recordDeviceHeartbeat } from "@/features/devices/services/record-device-heartbeat";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const HEARTBEAT_RATE_LIMIT = { limit: 12, windowMs: 60 * 1000 };

export async function POST(request: Request) {
  let device;
  try {
    device = await authenticateDevice(request.headers.get("authorization"));
  } catch (error) {
    return deviceErrorResponse(error, "heartbeat-auth");
  }
  if (!device) return deviceJson({ error: "UNAUTHORIZED" }, 401);

  if (!consumeRateLimit(`device-heartbeat:${device.deviceId}`, HEARTBEAT_RATE_LIMIT)) {
    return deviceJson({ error: "RATE_LIMITED" }, 429);
  }

  const body = await readDeviceJson(request);
  if (isInvalidDeviceBody(body)) return deviceJson({ error: "INVALID_REQUEST" }, 400);

  try {
    return deviceJson(await recordDeviceHeartbeat(device, body));
  } catch (error) {
    return deviceErrorResponse(error, "heartbeat");
  }
}
