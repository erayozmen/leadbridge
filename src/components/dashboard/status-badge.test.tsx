import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/dashboard/status-badge";

describe("StatusBadge", () => {
  it.each([
    ["ACTIVE", "Aktif"],
    ["DRAFT", "Taslak"],
    ["COMPLETED", "Tamamlandı"],
    ["ARCHIVED", "Arşivlendi"],
    ["ADMIN", "Yönetici"],
    ["STAFF", "Personel"],
  ])("renders %s with its Turkish label", (status, label) => {
    expect(renderToStaticMarkup(<StatusBadge status={status} />)).toContain(label);
  });
});
