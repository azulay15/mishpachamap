import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function browserSupabase() {
  return createBrowserClient(url, anonKey);
}

/**
 * For RSC / Server Actions / Route Handlers.
 * Pass Next.js's cookies() result via the cookieStore param.
 */
type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: CookieOptions) => void;
};

export function serverSupabase(cookieStore: CookieStore) {
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => {
        try {
          cookies.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* RSC contexts can't set cookies — safe no-op. */
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. ONLY for server-side ingest scripts.
 * Never import this from client code.
 */
export function adminSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
