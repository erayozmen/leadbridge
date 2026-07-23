import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/features/auth/types/auth";

const { requireActiveUser, listSelectableEvents, redirect } = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  listSelectableEvents: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/auth/server/auth", () => ({ requireActiveUser }));
vi.mock("@/features/events/server/event-context", () => ({ listSelectableEvents }));

import SelectEventPage from "@/app/select-event/page";

function collectVisibleValues(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(collectVisibleValues).join(" ");
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  const props = (node as { props: { children?: unknown; href?: unknown } }).props;
  return [typeof props.href === "string" ? props.href : "", collectVisibleValues(props.children)].join(" ");
}

describe("select event page", () => {
  beforeEach(() => {
    requireActiveUser.mockReset();
    listSelectableEvents.mockReset();
    redirect.mockClear();
  });

  it("redirects unauthenticated visitors instead of returning a server error", async () => {
    requireActiveUser.mockRejectedValue(new AuthError("UNAUTHENTICATED"));

    await expect(SelectEventPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(listSelectableEvents).not.toHaveBeenCalled();
  });

  it("renders a safe ADMIN state when only the completed legacy event exists", async () => {
    requireActiveUser.mockResolvedValue({ role: "ADMIN" });
    listSelectableEvents.mockResolvedValue([
      { id: "legacy", name: "Geçmiş Kayıtlar", status: "COMPLETED" },
    ]);

    const page = await SelectEventPage();
    const serialized = collectVisibleValues(page);

    expect(serialized).toContain("Aktif etkinlik bulunmuyor");
    expect(serialized).toContain("/dashboard/events/new");
    expect(serialized).toContain("Geçmiş Kayıtlar");
  });

  it("renders a safe STAFF state without exposing event creation", async () => {
    requireActiveUser.mockResolvedValue({ role: "STAFF" });
    listSelectableEvents.mockResolvedValue([]);

    const page = await SelectEventPage();
    const serialized = collectVisibleValues(page);

    expect(serialized).toContain("Aktif etkinlik bulunmuyor");
    expect(serialized).not.toContain("/dashboard/events/new");
  });
});
