import { resolve as aliases } from "../alias-loader.mjs";
const fixture = new URL("./ecr-fixture.mjs", import.meta.url).href;
export function resolve(specifier, context, nextResolve) {
  if (["@/lib/supabase/client", "@/lib/supabase/queries/myClasses"].includes(specifier)) return nextResolve(fixture, context);
  return aliases(specifier, context, nextResolve);
}
