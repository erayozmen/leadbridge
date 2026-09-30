import { authenticateDevice } from "@/features/devices/server/authenticate-device";
import { deviceErrorResponse, deviceJson } from "@/features/devices/server/device-route-helpers";
import { createVideoDownload } from "@/features/devices/services/agent-commands";
import { VideoError } from "@/features/videos/services/video-errors";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const DOWNLOAD_URL_RATE_LIMIT = { limit: 20, windowMs: 60 * 1000 };

/** Returns a short-lived signed Storage URL; the video bytes never pass through this function. */
export async function POST(request: Request, { params }: { params: Promise<{ videoId: string }> }) {
  let device;
  try {
    device = await authenticateDevice(request.headers.get("authorization"));
  } catch (error) {
    return deviceErrorResponse(error, "download-url-auth");
  }
  if (!device) return deviceJson({ error: "UNAUTHORIZED" }, 401);

  if (!consumeRateLimit(`device-download-url:${device.deviceId}`, DOWNLOAD_URL_RATE_LIMIT)) {
    return deviceJson({ error: "RATE_LIMITED" }, 429);
  }

  try {
    return deviceJson(await createVideoDownload(device, (await params).videoId));
  } catch (error) {
    if (error instanceof VideoError && error.code === "STORAGE_UNAVAILABLE") {
      return deviceJson({ error: "STORAGE_UNAVAILABLE" }, 503);
    }
    return deviceErrorResponse(error, "download-url");
  }
}
