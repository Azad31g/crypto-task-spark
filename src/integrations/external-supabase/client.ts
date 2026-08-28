import { createClient } from "@supabase/supabase-js";

// External (self-managed) Supabase project — the AZOX production backend.
// This is the source of truth for users, wallet_registrations, tasks,
// task completions, points, referrals, rankings, profiles, airdrop
// registration, and all existing AZOX backend data.
// Deliberately NOT driven by VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY,
// because those now point at the Lovable Cloud project.
const EXTERNAL_SUPABASE_URL = "https://oevefjiajicjtbhqvglk.supabase.co";
const EXTERNAL_SUPABASE_PUBLISHABLE_KEY =
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
