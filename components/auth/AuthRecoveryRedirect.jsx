"use client";

import { useEffect } from "react";

/**
 * Password-reset emails sometimes land on Site URL (/) instead of
 * /login/reset-password. Forward recovery tokens so the CNHS reset form runs.
 */
export default function AuthRecoveryRedirect() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (pathname !== "/") return;

    const blob = `${search}${hash}`.toLowerCase();
    const isRecovery =
      blob.includes("type=recovery") ||
      blob.includes("code=") ||
      blob.includes("token_hash=") ||
      blob.includes("access_token=");

    if (!isRecovery) return;

    window.location.replace(`/login/reset-password${search}${hash}`);
  }, []);

  return null;
}
