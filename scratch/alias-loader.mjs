import { resolve as pathResolve } from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const relativePath = specifier.replace("@/", "./");
    const absolutePath = pathResolve(rootDir, relativePath);
    let resolvedUrl = pathToFileURL(absolutePath).href;
    if (!resolvedUrl.endsWith(".js") && !resolvedUrl.endsWith(".jsx") && !resolvedUrl.endsWith(".mjs")) {
      resolvedUrl += ".js";
    }
    return defaultResolve(resolvedUrl, context, defaultResolve);
  }
  return defaultResolve(specifier, context, defaultResolve);
}
