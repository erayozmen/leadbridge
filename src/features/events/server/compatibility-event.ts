import { EventStatus } from "@prisma/client";

export const LEGACY_COMPATIBILITY_EVENT_ID = "leadbridge-legacy-event";

export function isLegacyCompatibilityEvent(
  eventId: string,
  status: EventStatus,
) {
  return eventId === LEGACY_COMPATIBILITY_EVENT_ID
    && status === EventStatus.COMPLETED;
}
