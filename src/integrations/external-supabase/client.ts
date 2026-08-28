import { createClient } from "@supabase/supabase-js";

// External (self-managed) Supabase project.
// The URL and publishable/anon key are safe to ship to the browser.
const EXTERNAL_SUPABASE_URL =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ||
  "https://oevefjiajicjtbhqvglk.supabase.co";

const EXTERNAL_SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldmVmamlhamljanRiaHF2Z2xrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTgyMTgsImV4cCI6MjEwMzEzNDIxOH0.vEru9_Ya6ByrUX-MewT96co8a5D2EGEsVXy5d1ero0g";

export const externalSupabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
// @ts-ignore - tasks table exists in the external Supabase project
