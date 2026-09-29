import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// TEMPORARY: one-off production DB connection fingerprint check. Remove after use.
export const dynamic = "force-dynamic";

const ACCESS_TOKEN_SHA256 = "75fc5383eccaac6533242c86f0aacf4a0d1b27b9b84d7ccbc73752079eea9cc0";

const sha256 = (value: string) => createHash("sha256").update(value.trim(), "utf8").digest("hex");

export async function POST(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const authorized = supplied.length > 0
    && timingSafeEqual(Buffer.from(sha256(supplied), "hex"), Buffer.from(ACCESS_TOKEN_SHA256, "hex"));
  if (!authorized) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const direct = process.env.DIRECT_URL;
  const database = process.env.DATABASE_URL;
  return NextResponse.json(
    { directUrlSha256: direct ? sha256(direct) : null, databaseUrlSha256: database ? sha256(database) : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
