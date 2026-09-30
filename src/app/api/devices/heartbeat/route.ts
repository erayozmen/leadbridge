import { authenticateDevice } from "@/features/devices/server/authenticate-device";
import {
  deviceErrorResponse,
  deviceJson,
  isInvalidDeviceBody,
  readDeviceJson,
} from "@/features/devices/server/device-route-helpers";
import { listPendingCommands, type PendingCommands } from "@/features/devices/services/agent-commands";
import { recordDeviceHeartbeat } from "@/features/devices/services/record-device-heartbeat";
import { IDLE_POLL_SECONDS } from "@/features/devices/lib/command-policy";
import { captureTechnicalException } from "@/lib/monitoring/capture";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// Allows the 5-second active poll interval with headroom.
const HEARTBEAT_RATE_LIMIT = { limit: 20, windowMs: 60 * 1000 };

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

  let heartbeat;
  try {
    heartbeat = await recordDeviceHeartbeat(device, body);
  } catch (error) {
    return deviceErrorResponse(error, "heartbeat");
  }

  // Commands ride on the heartbeat response instead of a separate polling endpoint; a failure here
  // must not turn a successful heartbeat into an error. Older Agents ignore the extra fields.
  let pending: PendingCommands = { commands: [], pollIntervalSeconds: IDLE_POLL_SECONDS };
  try {
    pending = await listPendingCommands(device.deviceId);
  } catch (error) {
    captureTechnicalException(error, { feature: "devices", operation: "list-commands" });
  }
  return deviceJson({ ...heartbeat, ...pending });
}
