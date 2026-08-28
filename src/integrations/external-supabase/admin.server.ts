// Server-only Supabase admin client for the external AZOX project.
// Uses the service role key (never exposed to the browser).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://oevefjiajicjtbhqvglk.supabase.co";

let _client: SupabaseClient | undefined;

export function getExternalSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const key = process.env["EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) {
    throw new Error("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  _client = createClient(SUPABASE_URL, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _client;
}
