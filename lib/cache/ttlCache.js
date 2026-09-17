/**
 * Tiny in-memory TTL + in-flight dedupe cache.
 * Stored on globalThis so Turbopack/HMR remounts do not wipe soft-nav hits.
 */

const DEFAULT_TTL_MS = 90_000;
const STORE_KEY = "__cnhs_ttl_cache_v1";

function getStore() {
  const root =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof window !== "undefined"
        ? window
        : {};
  if (!root[STORE_KEY]) {
    root[STORE_KEY] = {
      valueCache: new Map(),
      inflight: new Map(),
    };
  }
  return root[STORE_KEY];
}

export function cacheKey(parts = []) {
  return parts
    .map((part) =>
      part === null || part === undefined || part === "" ? "all" : String(part)
    )
    .join("|");
}

export function peekTtlInflight(key) {
  return getStore().inflight.get(key) ?? null;
}

export function readTtlCache(key) {
  const { valueCache } = getStore();
  const hit = valueCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    valueCache.delete(key);
    return null;
  }
  return hit.value;
}

export function writeTtlCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  const { valueCache } = getStore();
  valueCache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function invalidateTtlCache(prefix = null) {
  const { valueCache, inflight } = getStore();
  if (prefix == null) {
    valueCache.clear();
    inflight.clear();
    return;
  }
  for (const key of [...valueCache.keys()]) {
    if (key.startsWith(prefix)) valueCache.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

/**
 * Return cached value or share one in-flight promise for the same key.
 */
export async function withTtlCache(
  key,
  factory,
  ttlMs = DEFAULT_TTL_MS,
  shouldCache = null
) {
  const { inflight } = getStore();
  const cached = readTtlCache(key);
  if (cached !== null && cached !== undefined) return cached;

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    const value = await factory();
    const isFailure =
      value &&
      typeof value === "object" &&
      ((value.error && value.data == null && value.ok !== true) ||
        value.ok === false);
    const allowed =
      typeof shouldCache !== "function" ? true : Boolean(shouldCache(value));
    if (!isFailure && allowed) {
      writeTtlCache(key, value, ttlMs);
    }
    return value;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}
