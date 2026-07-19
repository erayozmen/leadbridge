import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const supabaseEnv = getSupabaseEnv();

  return createBrowserClient(supabaseEnv.url, supabaseEnv.publishableKey);
}
