"use client";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function useAuth() {
  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { data: null, error };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, full_name, is_active")
      .eq("auth_user_id", data.user.id)
      .single();

    if (profileError) {
      return { data: null, error: profileError };
    }

    if (profile.is_active === false) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: new Error("Your account is inactive. Contact the administrator."),
      };
    }

    // Cache role in JWT user_metadata so middleware can skip a profiles query
    // on subsequent navigations. RLS still enforces real authorization.
    await supabase.auth.updateUser({
      data: {
        portal_role: profile.role,
        portal_active: true,
      },
    });

    return {
      data: {
        user: data.user,
        role: profile.role,
        full_name: profile.full_name,
      },
      error: null,
    };
  }

  async function signOut() {
    await supabase.auth.updateUser({
      data: {
        portal_role: null,
        portal_active: null,
      },
    });
    return await supabase.auth.signOut();
  }

  /**
   * Re-authenticate with current password, then set a new password.
   */
  async function changePassword({ currentPassword, newPassword }) {
    const current = String(currentPassword ?? "");
    const next = String(newPassword ?? "");

    if (!current || !next) {
      return {
        data: null,
        error: new Error("Current and new passwords are required."),
      };
    }
    if (next.length < 8) {
      return {
        data: null,
        error: new Error("New password must be at least 8 characters."),
      };
    }
    if (current === next) {
      return {
        data: null,
        error: new Error("New password must be different from the current password."),
      };
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return {
        data: null,
        error: userError ?? new Error("Not authenticated."),
      };
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (reauthError) {
      return {
        data: null,
        error: new Error("Current password is incorrect."),
      };
    }

    const { data, error } = await supabase.auth.updateUser({
      password: next,
    });

    if (error) {
      return { data: null, error };
    }

    // Clear admin-issued temporary password display after a successful change.
    const { error: clearError } = await supabase
      .from("profiles")
      .update({
        must_change_password: false,
        temp_password: null,
      })
      .eq("auth_user_id", user.id);

    if (clearError) {
      return {
        data,
        error: new Error(
          "Password updated, but temporary password flag could not be cleared. Refresh and try again, or contact the administrator."
        ),
      };
    }

    return { data, error: null };
  }

  return {
    signIn,
    signOut,
    changePassword,
  };
}