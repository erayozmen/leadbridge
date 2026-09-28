import { z } from "zod";

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();
const deviceName = z.string().trim().min(2).max(80);

export const createDevicePairingSchema = z
  .object({
    name: deviceName,
    eventId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const pairDeviceSchema = z
  .object({
    pairingCode: z.string().trim().min(1).max(32),
    name: deviceName.optional(),
    serialNumber: optionalText(64),
    model: optionalText(64),
    appVersion: optionalText(32),
  })
  .strict();

export const deviceHeartbeatSchema = z
  .object({
    appVersion: z.string().trim().min(1).max(32),
  })
  .strict();

export type CreateDevicePairingInput = z.infer<typeof createDevicePairingSchema>;
export type PairDeviceInput = z.infer<typeof pairDeviceSchema>;
export type DeviceHeartbeatInput = z.infer<typeof deviceHeartbeatSchema>;
