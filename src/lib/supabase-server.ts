import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/env";

export function createServiceSupabaseClient() {
  const publicEnv = getSupabasePublicEnv();
  const serviceRole = getSupabaseServiceRoleKey();

  return createClient(publicEnv.supabaseUrl, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
