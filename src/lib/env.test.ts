import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseAdminEnv } from "@/lib/env";

describe("Supabase admin environment", () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  afterEach(() => {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
  });

  it("fails safely when the server-only service role key is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(() => getSupabaseAdminEnv()).toThrow("AUTH_ADMIN_NOT_CONFIGURED");
  });
});
