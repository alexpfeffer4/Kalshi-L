import { createClient } from "@supabase/supabase-js";
import { assertSupabaseConfig, getRuntimeConfigStatus } from "./env";

export function hasSupabaseConfig() {
  return getRuntimeConfigStatus().hasSupabase;
}

export function createSupabaseServerClient() {
  assertSupabaseConfig();

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
