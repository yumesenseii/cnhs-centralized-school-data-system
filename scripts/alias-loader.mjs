import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const rootDir = process.cwd();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-cnhs.supabase.co";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";
}

export async function resolve(specifier, context, nextResolve) {
  let target = specifier;

  if (target.startsWith("@/")) {
    let resolvedPath = path.resolve(rootDir, target.slice(2));
    if (!fs.existsSync(resolvedPath)) {
      if (fs.existsSync(resolvedPath + ".js")) {
        resolvedPath = resolvedPath + ".js";
      } else if (fs.existsSync(resolvedPath + ".jsx")) {
        resolvedPath = resolvedPath + ".jsx";
      } else if (fs.existsSync(path.join(resolvedPath, "index.js"))) {
        resolvedPath = path.join(resolvedPath, "index.js");
      }
    }
    return nextResolve(pathToFileURL(resolvedPath).href, context);
  }

  // Handle relative extensionless imports
  if (target.startsWith("./") || target.startsWith("../")) {
    if (context.parentURL && context.parentURL.startsWith("file:")) {
      const parentDir = path.dirname(new URL(context.parentURL).pathname.replace(/^\/([a-zA-Z]:)/, "$1"));
      let candidate = path.resolve(parentDir, target);
      if (!fs.existsSync(candidate)) {
        if (fs.existsSync(candidate + ".js")) {
          return nextResolve(pathToFileURL(candidate + ".js").href, context);
        } else if (fs.existsSync(candidate + ".jsx")) {
          return nextResolve(pathToFileURL(candidate + ".jsx").href, context);
        } else if (fs.existsSync(path.join(candidate, "index.js"))) {
          return nextResolve(pathToFileURL(path.join(candidate, "index.js")).href, context);
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
