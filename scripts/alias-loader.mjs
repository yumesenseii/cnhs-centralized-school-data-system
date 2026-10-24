import { resolve as pathResolve } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync, statSync } from "node:fs";

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const basePath = pathResolve(process.cwd(), specifier.slice(2));
    const candidates = [
      basePath,
      basePath + ".js",
      basePath + ".jsx",
      basePath + ".mjs",
      pathResolve(basePath, "index.js"),
      pathResolve(basePath, "index.jsx"),
    ];

    for (const c of candidates) {
      if (existsSync(c) && !statSync(c).isDirectory()) {
        return nextResolve(pathToFileURL(c).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
