import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function requireAdmin(actionLabel = "perform this action") {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      profile: null,
      user: null,
      error: userError ?? new Error("Not authenticated"),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, auth_user_id, full_name, role, is_active, must_change_password, temp_password"
    )
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      profile: null,
      user,
      error: profileError ?? new Error("Unable to load profile."),
    };
  }

  if (profile.role !== "admin") {
    return {
      ok: false,
      profile,
      user,
      error: new Error(`Only administrators can ${actionLabel}.`),
    };
  }

  if (profile.is_active === false) {
    return {
      ok: false,
      profile,
      user,
      error: new Error("Your administrator account is inactive."),
    };
  }

  return { ok: true, profile, user, error: null };
}

export async function getAdminSession() {
  const result = await requireAdmin("access admin tools");
  if (!result.ok) {
    return { data: null, error: result.error };
  }
  return { data: result.profile, error: null };
}

function initialsFromName(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "HT"
  );
}

/**
 * Live Head Teacher identity for Admin Settings (Personal Account + Security).
 */
export async function getAdminSettingsProfile() {
  const result = await requireAdmin("view settings");
  if (!result.ok) {
    return { data: null, error: result.error };
  }

  const { profile, user } = result;
  const email = String(user.email ?? "").trim().toLowerCase();

  const [{ data: account }, { data: teacher }] = await Promise.all([
    supabase
      .from("users")
      .select("id, username, email, status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("teachers")
      .select("employee_number, contact_number, email, status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const fullName = String(profile.full_name ?? "").trim() || "Head Teacher";
  const username =
    account?.username ||
    (email ? email.split("@")[0] : "") ||
    "admin";
  const tempPassword = String(profile.temp_password ?? "").trim();
  const mustChange =
    Boolean(profile.must_change_password) && Boolean(tempPassword);

  return {
    data: {
      profile,
      account: {
        initials: initialsFromName(fullName),
        fullName,
        employeeId: teacher?.employee_number || "—",
        email: teacher?.email || account?.email || email || "—",
        phone: teacher?.contact_number || "—",
        username,
        role: "Head Teacher",
        status:
          profile.is_active === false
            ? "Inactive"
            : teacher?.status === "inactive"
              ? "Inactive"
              : "Active",
      },
      security: {
        mustChangePassword: mustChange,
        tempPassword: mustChange ? tempPassword : "",
        email: email || "—",
      },
    },
    error: null,
  };
}
