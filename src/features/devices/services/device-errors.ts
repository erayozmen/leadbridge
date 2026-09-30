export type DeviceErrorCode =
  | "INVALID_PAIRING_CODE"
  | "SERIAL_NUMBER_IN_USE"
  | "DEVICE_DISABLED"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_NAME_IN_USE"
  | "DEVICE_STATE_CONFLICT"
  | "COMMAND_NOT_FOUND"
  | "COMMAND_CANCELLED"
  | "COMMAND_EXPIRED"
  | "DEVICE_OFFLINE"
  | "INVALID_COMMAND_TRANSITION"
  | "VIDEO_NOT_AVAILABLE"
  | "DOWNLOAD_NOT_AUTHORIZED";

export class DeviceError extends Error {
  constructor(readonly code: DeviceErrorCode) {
    super(code);
    this.name = "DeviceError";
  }
}
