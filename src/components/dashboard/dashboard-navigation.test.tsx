import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/qr-registrations",
}));

import {
  DashboardNavigation,
  handleNavigationClick,
} from "@/components/dashboard/dashboard-navigation";

const primaryClick = {
  altKey: false,
  button: 0,
  ctrlKey: false,
  defaultPrevented: false,
  metaKey: false,
  shiftKey: false,
};

describe("dashboard navigation interaction", () => {
  it("closes the mobile navigation after a normal route selection", () => {
    const onNavigate = vi.fn();
    handleNavigationClick(primaryClick, onNavigate);
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("does not change desktop sidebar state without a mobile callback", () => {
    expect(() => handleNavigationClick(primaryClick)).not.toThrow();
  });

  it("keeps Next.js hrefs, active state, and role visibility intact", () => {
    const adminHtml = renderToStaticMarkup(<DashboardNavigation role="ADMIN" />);
    const staffHtml = renderToStaticMarkup(<DashboardNavigation role="STAFF" />);

    expect(adminHtml).toContain('href="/dashboard/qr-registrations"');
    expect(adminHtml).toContain('aria-current="page"');
    expect(adminHtml).toContain("Kullanıcılar");
    expect(staffHtml).not.toContain("Kullanıcılar");
  });

  it.each([
    { ...primaryClick, button: 1 },
    { ...primaryClick, ctrlKey: true },
    { ...primaryClick, metaKey: true },
    { ...primaryClick, shiftKey: true },
    { ...primaryClick, altKey: true },
    { ...primaryClick, defaultPrevented: true },
  ])("preserves modified and new-tab navigation", (event) => {
    const onNavigate = vi.fn();
    handleNavigationClick(event, onNavigate);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
