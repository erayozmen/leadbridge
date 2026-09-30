import { authenticateDevice } from "@/features/devices/server/authenticate-device";
import {
  deviceErrorResponse,
  deviceJson,
  isInvalidDeviceBody,
  readDeviceJson,
} from "@/features/devices/server/device-route-helpers";
import { reportCommandStatus } from "@/features/devices/services/agent-commands";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const STATUS_RATE_LIMIT = { limit: 30, windowMs: 60 * 1000 };

export async function POST(request: Request, { params }: { params: Promise<{ commandId: string }> }) {
  let device;
  try {
    device = await authenticateDevice(request.headers.get("authorization"));
  } catch (error) {
    return deviceErrorResponse(error, "command-status-auth");
  }
  if (!device) return deviceJson({ error: "UNAUTHORIZED" }, 401);

  if (!consumeRateLimit(`device-command-status:${device.deviceId}`, STATUS_RATE_LIMIT)) {
    return deviceJson({ error: "RATE_LIMITED" }, 429);
  }

  const body = await readDeviceJson(request);
  if (isInvalidDeviceBody(body)) return deviceJson({ error: "INVALID_REQUEST" }, 400);

  try {
    return deviceJson(await reportCommandStatus(device, (await params).commandId, body));
  } catch (error) {
    return deviceErrorResponse(error, "command-status");
  }
}
