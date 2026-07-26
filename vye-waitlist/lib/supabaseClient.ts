// Vye — browser Supabase client (safe for the waitlist).
// If you ALREADY have a supabase client in your project, skip this file
// and import your existing one into WaitlistForm.tsx instead.
//
// The anon key is meant to be public — it's safe in the browser because
// Row Level Security (see supabase/waitlist.sql) is what actually gates
// access. Never put the service_role key in client code.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly in dev if env vars are missing.
  // eslint-disable-next-line no-console
  console.warn("[vye] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url!, anonKey!);
