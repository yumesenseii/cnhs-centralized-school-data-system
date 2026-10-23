/**
 * Resolution loader for the P0-04B scoped route tests.
 *
 * On top of the repository's `@/` alias handling (see scripts/alias-loader.mjs)
 * it adds:
 *   1. `next/server` -> `next/server.js` (Next ships no exports map, so plain
 *      Node ESM cannot resolve the extensionless subpath),
 *   2. deterministic mocks for the Supabase server client and for the remote
 *      inference client, so the REAL route module can be executed in Node.
 *
 * Run:
 *   node --no-warnings --loader ./scripts/test-support/trend-route-loader.mjs \
 *        scripts/test_p0_04b_scoped_route.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
const supportDir = path.join(rootDir, "scripts", "test-support");

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-cnhs.supabase.co";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";
}

const MOCK_MODULES = {
  "@/lib/supabase/server": path.join(supportDir, "mock-supabase-server.mjs"),
  "@/lib/services/recommendation/inferenceClient": path.join(
    supportDir,
    "mock-inference-client.mjs"
  ),
};

export async function resolve(specifier, context, nextResolve) {
  if (MOCK_MODULES[specifier]) {
    return nextResolve(pathToFileURL(MOCK_MODULES[specifier]).href, context);
  }

  if (specifier === "next/server") {
    return nextResolve(
      pathToFileURL(
        path.join(rootDir, "node_modules", "next", "server.js")
      ).href,
      context
    );
  }

  if (specifier.startsWith("@/")) {
    let resolvedPath = path.resolve(rootDir, specifier.slice(2));
    if (!fs.existsSync(resolvedPath)) {
      if (fs.existsSync(`${resolvedPath}.js`)) {
        resolvedPath = `${resolvedPath}.js`;
      } else if (fs.existsSync(`${resolvedPath}.jsx`)) {
        resolvedPath = `${resolvedPath}.jsx`;
      } else if (fs.existsSync(path.join(resolvedPath, "index.js"))) {
        resolvedPath = path.join(resolvedPath, "index.js");
      }
    }
    return nextResolve(pathToFileURL(resolvedPath).href, context);
  }

  return nextResolve(specifier, context);
}
