import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/devices/actions/device-actions", () => ({
  createDevicePairingAction: vi.fn(),
  renewDevicePairingAction: vi.fn(),
  cancelDevicePairingAction: vi.fn(),
  disableDeviceAction: vi.fn(),
}));

import { DeviceRowActions } from "@/features/devices/components/device-row-actions";

describe("DeviceRowActions", () => {
  it("offers renew and cancel for pending devices without exposing a form before confirmation", () => {
    const html = renderToStaticMarkup(<DeviceRowActions deviceId="device_1" status="PENDING" />);
    expect(html).toContain("Kodu Yenile");
    expect(html).toContain("Eşleşmeyi İptal Et");
    expect(html).not.toContain("Cihazı Kaldır");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("device_1");
  });

  it("offers only removal for active devices", () => {
    const html = renderToStaticMarkup(<DeviceRowActions deviceId="device_1" status="ACTIVE" />);
    expect(html).toContain("Cihazı Kaldır");
    expect(html).not.toContain("Kodu Yenile");
    expect(html).not.toContain("Eşleşmeyi İptal Et");
  });

  it("offers re-pairing for disabled devices", () => {
    const html = renderToStaticMarkup(<DeviceRowActions deviceId="device_1" status="DISABLED" />);
    expect(html).toContain("Yeniden Eşleştir");
    expect(html).not.toContain("Cihazı Kaldır");
  });
});
