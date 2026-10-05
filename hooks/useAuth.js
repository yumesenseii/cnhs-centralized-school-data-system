"use client";

import { validateNewPassword } from "@/lib/auth/passwordPolicy";
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
      .select(
        "role, full_name, is_active, must_change_password, accepted_terms_at, temp_password"
      )
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
    const mustChangePassword = Boolean(profile.must_change_password);
    const hasTempPassword = Boolean(String(profile.temp_password ?? "").trim());
    const acceptedTerms = Boolean(profile.accepted_terms_at);
    const needsPasswordSetup = mustChangePassword || hasTempPassword;
    const needsFirstLogin =
      profile.role === "student"
        ? needsPasswordSetup || !acceptedTerms
        : (profile.role === "admin" || profile.role === "teacher") &&
          needsPasswordSetup;

    await supabase.auth.updateUser({
      data: {
        portal_role: profile.role,
        portal_active: true,
        must_change_password: needsFirstLogin,
      },
    });

    return {
      data: {
        user: data.user,
        role: profile.role,
        full_name: profile.full_name,
        mustChangePassword: needsFirstLogin,
        needsFirstLogin,
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
  async function changePassword({
    currentPassword,
    newPassword,
    clearOnboarding = true,
  }) {
    const current = String(currentPassword ?? "");
    const next = String(newPassword ?? "");

    if (!current || !next) {
      return {
        data: null,
        error: new Error("Current and new passwords are required."),
      };
    }
    const policyError = validateNewPassword(next, current);
    if (policyError) {
      return { data: null, error: new Error(policyError) };
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

    if (clearOnboarding) {
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
    }

    return { data, error: null };
  }

  /**
   * First login for Teacher / School Principal / Student: new password + Terms.
   */
  async function completeFirstLogin({
    currentPassword,
    newPassword,
    acceptedTerms,
  }) {
    if (!acceptedTerms) {
      return {
        data: null,
        error: new Error(
          "Accept the Terms of Use and Privacy Policy to continue."
        ),
      };
    }

    const changed = await changePassword({
      currentPassword,
      newPassword,
      clearOnboarding: false,
    });
    if (changed.error) return changed;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return { data: changed.data, error: null };
    }

    const { data: profile, error: termsError } = await supabase
      .from("profiles")
      .update({
        accepted_terms_at: new Date().toISOString(),
        must_change_password: false,
        temp_password: null,
      })
      .eq("auth_user_id", user.id)
      .select("role, full_name")
      .maybeSingle();

    if (termsError) {
      return {
        data: changed.data,
        error: new Error(
          "Password updated, but Terms acceptance could not be saved. Refresh and try again."
        ),
      };
    }

    await supabase.auth.updateUser({
      data: {
        must_change_password: false,
        portal_role: profile?.role || user.user_metadata?.portal_role,
        portal_active: true,
      },
    });

    return {
      data: {
        ...changed.data,
        role: profile?.role || null,
        full_name: profile?.full_name || null,
      },
      error: null,
    };
  }

  /** Accept Terms/Privacy without changing password (Profile). */
  async function acceptTermsOfUse() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      return {
        data: null,
        error: userError ?? new Error("Not authenticated."),
      };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ accepted_terms_at: new Date().toISOString() })
      .eq("auth_user_id", user.id)
      .select("role, full_name, accepted_terms_at")
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    return { data: profile, error: null };
  }

  return {
    signIn,
    signOut,
    changePassword,
    completeFirstLogin,
    acceptTermsOfUse,
  };
}