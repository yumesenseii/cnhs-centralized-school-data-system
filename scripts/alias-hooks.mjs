/**
 * Resolution hooks for `@/` path alias (registered by alias-loader.mjs).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveAliasPath(rel) {
  const base = path.join(root, rel);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.json`,
    path.join(base, "index.js"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return pathToFileURL(candidate).href;
      }
    } catch {
      // try next
    }
  }
  return pathToFileURL(`${base}.js`).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return {
      shortCircuit: true,
      url: resolveAliasPath(specifier.slice(2)),
    };
  }
  return nextResolve(specifier, context);
}
