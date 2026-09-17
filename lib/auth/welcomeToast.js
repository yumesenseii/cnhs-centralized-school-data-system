const WELCOME_TOAST_KEY = "cnhs-welcome-toast";

/**
 * Queue a one-shot welcome toast after a successful login redirect.
 * Consumed by portal shells; cleared when shown.
 */
export function queueWelcomeToast(fullName) {
  if (typeof window === "undefined") return;
  const name = String(fullName ?? "").trim() || "there";
  try {
    window.sessionStorage.setItem(
      WELCOME_TOAST_KEY,
      JSON.stringify({ name, at: Date.now() })
    );
  } catch {
    // ignore quota / private mode
  }
}

export function consumeWelcomeToast() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(WELCOME_TOAST_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(WELCOME_TOAST_KEY);
    const parsed = JSON.parse(raw);
    const name = String(parsed?.name ?? "").trim();
    if (!name) return null;
    // Ignore stale flags older than 2 minutes (e.g. leftover tab).
    if (parsed?.at && Date.now() - Number(parsed.at) > 120_000) return null;
    return { name };
  } catch {
    try {
      window.sessionStorage.removeItem(WELCOME_TOAST_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}
