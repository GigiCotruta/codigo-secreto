import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

export function createBrowserSupabaseClient() {
  const env = getSupabasePublicEnv();

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}
