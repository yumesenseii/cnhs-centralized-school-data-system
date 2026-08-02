import { createBrowserClient } from "@supabase/ssr";

let browserClient = null;

/**
 * Shared browser Supabase client (cookie-based via @supabase/ssr).
 * Multiple GoTrue clients with the same storage key race and can drop the session.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof window === "undefined") {
    return createBrowserClient(url, anonKey);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }

  return browserClient;
}
