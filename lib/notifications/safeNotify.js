/**
 * Notification bookkeeping runs after a module mutation has already succeeded.
 * It must never throw, or a successful save would surface as a failure.
 */
export function safeNotify(fn, label) {
  return async function guarded(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      console.warn(`[notifications] ${label} failed:`, error?.message ?? error);
      return undefined;
    }
  };
}
