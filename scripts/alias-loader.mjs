/**
 * Node custom loader: map `@/` → project root (+ `.js` when needed).
 *
 *   node --import ./scripts/alias-loader.mjs scripts/check-eclass-input-roster.mjs [xlsx]
 */
import { register } from "node:module";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

register("./alias-hooks.mjs", pathToFileURL(path.join(root, "scripts/")));

export { root };
