import { createClient } from "@supabase/supabase-js";

// Server-only client for API routes. It has no session of its own: it reads
// public data (RLS applies) and verifies access tokens sent by signed-in users.
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);