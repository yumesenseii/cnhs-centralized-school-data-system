export const PASSWORD_HINT =
  "8–32 characters, with at least one uppercase letter, one lowercase letter, and one number.";

export function validateNewPassword(password, currentPassword = "") {
  const next = String(password ?? "");
  const current = String(currentPassword ?? "");

  if (next.length < 8 || next.length > 32) {
    return "Password must be 8–32 characters.";
  }
  if (!/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/[0-9]/.test(next)) {
    return "Include an uppercase letter, a lowercase letter, and a number.";
  }
  if (current && next === current) {
    return "New password must be different from the current password.";
  }
  return "";
}
