/**
 * Mock of `@/lib/supabase/server` used by the P0-04B scoped route tests.
 *
 * The real module reads the request cookie store, which cannot be booted outside
 * a Next.js request. The tests install a recording client instead, so the REAL
 * route module can be executed and its query filters asserted.
 */

let currentClient = null;

export function setSupabaseClient(client) {
  currentClient = client;
}

export function resetSupabaseClient() {
  currentClient = null;
}

export async function createClient() {
  if (!currentClient) {
    throw new Error(
      "No mock Supabase client configured. Call setSupabaseClient() before invoking the route."
    );
  }
  return currentClient;
}
