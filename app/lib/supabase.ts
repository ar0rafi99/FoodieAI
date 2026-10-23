
import { createBrowserClient } from "@supabase/ssr";

// Browser client. The session is stored in cookies (not localStorage), so the
// server-side proxy (proxy.ts) can verify who is signed in before serving /admin.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);