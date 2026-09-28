export type DeviceErrorCode =
  | "INVALID_PAIRING_CODE"
  | "SERIAL_NUMBER_IN_USE"
  | "DEVICE_DISABLED";

export class DeviceError extends Error {
  constructor(readonly code: DeviceErrorCode) {
    super(code);
    this.name = "DeviceError";
  }
}
