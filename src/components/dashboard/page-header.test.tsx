import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/dashboard/page-header";
import { QrCode } from "lucide-react";

describe("PageHeader", () => {
  it("renders title, description and accessible action links", () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="QR Kayıtları"
        description="Kayıtları yönetin."
        icon={QrCode}
        actions={<a href="/dashboard/qr-codes">QR yönetimine git</a>}
      />,
    );
    expect(html).toContain("<h1");
    expect(html).toContain("QR Kayıtları");
    expect(html).toContain('href="/dashboard/qr-codes"');
  });
});
