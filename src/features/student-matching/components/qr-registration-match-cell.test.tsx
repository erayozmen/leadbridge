import { UserRole } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/student-matching/actions/student-match-actions", () => ({
  createStudentMatchAction: vi.fn(),
  deleteStudentMatchAction: vi.fn(),
}));

import { QrRegistrationMatchCell } from "@/features/student-matching/components/qr-registration-match-cell";

const matchedRegistration = {
  id: "registration_1",
  firstName: "Ayşe",
  lastName: "Yılmaz",
  studentMatch: {
    id: "match_1",
    vrRecord: {
      id: "vr_1",
      firstName: "Ayşe",
      lastName: "Yılmaz",
    },
  },
};

describe("QrRegistrationMatchCell", () => {
  it("shows the removal action to ADMIN for a matched registration", () => {
    const html = renderToStaticMarkup(
      <QrRegistrationMatchCell role={UserRole.ADMIN} registration={matchedRegistration} />,
    );
    expect(html).toContain("Eşleşti");
    expect(html).toContain("Eşleşmeyi Kaldır");
  });

  it("does not show the removal action or reason UI to STAFF", () => {
    const html = renderToStaticMarkup(
      <QrRegistrationMatchCell role={UserRole.STAFF} registration={matchedRegistration} />,
    );
    expect(html).toContain("Eşleşti");
    expect(html).not.toContain("Eşleşmeyi Kaldır");
    expect(html).not.toContain("İşlem nedeni");
  });

  it("does not show the action for an unmatched registration", () => {
    const html = renderToStaticMarkup(
      <QrRegistrationMatchCell
        role={UserRole.ADMIN}
        registration={{ ...matchedRegistration, studentMatch: null }}
      />,
    );
    expect(html).toContain("Eşleşmedi");
    expect(html).not.toContain("Eşleşmeyi Kaldır");
  });
});
