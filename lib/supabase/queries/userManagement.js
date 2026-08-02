import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/supabase/queries/adminAuth";

const EMPTY_PROGRESS = {
  eClassSubmission: { label: "—", tone: "slate" },
  lessonPlanSubmission: { label: "—", tone: "slate" },
  submissionSummary: {
    eClass: [],
    lessonPlans: [],
  },
  recentActivity: [],
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function titleCase(value = "") {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function roleLabel(role) {
  return role === "admin" ? "Head Teacher" : "Teacher";
}

function statusLabel(active, fallback = "active") {
  if (active === false || String(fallback).toLowerCase() !== "active") {
    return "Inactive";
  }
  return "Active";
}

function classLabel(row) {
  const section = Array.isArray(row.sections) ? row.sections[0] : row.sections;
  const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
  const grade =
    section?.grade_level != null ? `Grade ${section.grade_level}` : "Grade";
  const sectionName = section?.section_name ?? "Section";
  const subjectName = subject?.subject_name ? ` · ${subject.subject_name}` : "";
  return `${grade} - ${sectionName}${subjectName}`;
}

function teacherName(teacher, profile) {
  const parts = [
    teacher?.first_name,
    teacher?.middle_name,
    teacher?.last_name,
  ].filter(Boolean);
  return parts.join(" ").trim() || profile.full_name || "User";
}

function mapUser(profile, teacher, account, classes) {
  const fullName = teacherName(teacher, profile);
  const assignedClasses = classes.map(classLabel);
  const email = teacher?.email || account?.email || "";
  const learningArea =
    teacher?.learning_area ||
    (profile.role === "admin" ? "Administration" : "Unassigned");

  return {
    id: profile.id,
    authUserId: profile.auth_user_id,
    teacherId: teacher?.id ?? null,
    firstName: teacher?.first_name ?? fullName.split(" ")[0] ?? "",
    lastName: teacher?.last_name ?? fullName.split(" ").at(-1) ?? "",
    fullName,
    username: account?.username || email.split("@")[0] || "—",
    initials: initials(fullName),
    avatarTone: profile.role === "admin" ? "purple" : "green",
    employeeId: teacher?.employee_number ?? "—",
    role: roleLabel(profile.role),
    learningArea,
    assignedClasses,
    email,
    phone: teacher?.contact_number ?? "—",
    status: statusLabel(profile.is_active, teacher?.status ?? account?.status),
    createdDate: formatDate(profile.created_at ?? teacher?.created_at),
    lastLogin: "—",
    lastPasswordReset: "—",
    ...EMPTY_PROGRESS,
  };
}

export async function getManagedUsers() {
  const admin = await requireAdmin("manage users");
  if (!admin.ok) return { data: null, error: admin.error };

  const supabase = createClient();
  const [
    { data: profiles, error: profilesError },
    { data: teachers, error: teachersError },
    { data: accounts, error: accountsError },
    { data: classes, error: classesError },
    { data: subjects, error: subjectsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, auth_user_id, full_name, role, is_active, created_at")
      .in("role", ["admin", "teacher"])
      .order("created_at", { ascending: true }),
    supabase.from("teachers").select(
      "id, user_id, employee_number, first_name, middle_name, last_name, email, learning_area, contact_number, status, created_at"
    ),
    supabase
      .from("users")
      .select("id, username, email, role, status, created_at"),
    supabase.from("classes").select(
      "id, teacher_id, sections(grade_level, section_name), subjects(subject_name)"
    ),
    supabase.from("subjects").select("subject_name").order("subject_name"),
  ]);

  const error =
    profilesError ||
    teachersError ||
    accountsError ||
    classesError ||
    subjectsError;
  if (error) return { data: null, error };

  const teacherByUser = new Map((teachers ?? []).map((row) => [row.user_id, row]));
  const accountById = new Map((accounts ?? []).map((row) => [row.id, row]));
  // The original Head Teacher may predate public.users; use the verified
  // caller's Auth email so the real account still renders completely.
  if (admin.user?.id && !accountById.has(admin.user.id)) {
    accountById.set(admin.user.id, {
      id: admin.user.id,
      email: admin.user.email ?? "",
      username: admin.user.email?.split("@")[0] ?? "admin",
      status: admin.profile?.is_active === false ? "inactive" : "active",
    });
  }
  const classesByTeacher = new Map();
  for (const row of classes ?? []) {
    if (!row.teacher_id) continue;
    const list = classesByTeacher.get(row.teacher_id) ?? [];
    list.push(row);
    classesByTeacher.set(row.teacher_id, list);
  }

  const users = (profiles ?? []).map((profile) => {
    const teacher = teacherByUser.get(profile.auth_user_id);
    return mapUser(
      profile,
      teacher,
      accountById.get(profile.auth_user_id),
      teacher ? classesByTeacher.get(teacher.id) ?? [] : []
    );
  });

  const active = users.filter((user) => user.status === "Active").length;
  return {
    data: {
      users,
      summaryCards: [
        { id: "total", label: "Total Users", count: users.length, icon: "users", tone: "teal" },
        {
          id: "teachers",
          label: "Teachers",
          count: users.filter((user) => user.role === "Teacher").length,
          icon: "teacher",
          tone: "green",
        },
        {
          id: "head-teachers",
          label: "Head Teachers",
          count: users.filter((user) => user.role === "Head Teacher").length,
          icon: "shield",
          tone: "purple",
        },
        { id: "active", label: "Active Accounts", count: active, icon: "check", tone: "green" },
      ],
      filters: {
        roles: ["All Roles", "Teacher", "Head Teacher"],
        learningAreas: [
          "All Learning Areas",
          ...new Set(users.map((user) => user.learningArea).filter(Boolean)),
        ],
        statuses: ["All Status", "Active", "Inactive"],
      },
      formOptions: {
        roles: ["Teacher", "Head Teacher"],
        learningAreas: [
          ...(subjects ?? []).map((row) => row.subject_name),
          "Administration",
        ],
        statuses: ["Active", "Inactive"],
      },
    },
    error: null,
  };
}

export async function createManagedUser(payload) {
  const admin = await requireAdmin("create user accounts");
  if (!admin.ok) return { data: null, error: admin.error };

  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: {
      ...payload,
      role: payload.role === "Head Teacher" ? "admin" : "teacher",
      status: String(payload.status).toLowerCase(),
    },
  });

  if (error) return { data: null, error };
  if (!data?.ok) {
    return { data: null, error: new Error(data?.error || "Unable to create user.") };
  }
  return { data: data.user, error: null };
}

/**
 * Sync Auth login email (+ public.users / teachers.email) via service-role edge fn.
 */
export async function updateManagedUserEmail({ authUserId, email }) {
  const admin = await requireAdmin("update user login emails");
  if (!admin.ok) return { data: null, error: admin.error };

  if (!authUserId) {
    return { data: null, error: new Error("User auth id is required.") };
  }
  const nextEmail = String(email ?? "").trim().toLowerCase();
  if (!nextEmail) {
    return { data: null, error: new Error("Email is required.") };
  }

  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(
    "admin-update-user-email",
    {
      body: { authUserId, email: nextEmail },
    }
  );

  if (error) return { data: null, error };
  if (!data?.ok) {
    return {
      data: null,
      error: new Error(data?.error || "Unable to update login email."),
    };
  }

  return { data, error: null };
}

/**
 * Update profile (+ teachers row when present). When email changes, syncs Auth
 * login via admin-update-user-email. Does not change class assignments.
 */
export async function updateManagedUser(payload) {
  const admin = await requireAdmin("update user accounts");
  if (!admin.ok) return { data: null, error: admin.error };

  const profileId = payload?.id;
  if (!profileId) {
    return { data: null, error: new Error("User id is required.") };
  }

  const fullName = String(payload.fullName ?? "").trim();
  if (!fullName) {
    return { data: null, error: new Error("Name is required.") };
  }

  const statusLabel = String(payload.status ?? "Active");
  const isActive = statusLabel.toLowerCase() !== "inactive";
  const teacherStatus = isActive ? "active" : "inactive";
  const email = String(payload.email ?? "").trim().toLowerCase();
  const learningArea = String(payload.learningArea ?? "").trim();
  const phone = String(payload.phone ?? "").trim();

  const supabase = createClient();

  const { data: current, error: currentError } = await supabase
    .from("profiles")
    .select("id, auth_user_id, full_name, role, is_active")
    .eq("id", profileId)
    .single();

  if (currentError || !current) {
    return {
      data: null,
      error: currentError ?? new Error("User profile not found."),
    };
  }

  const [{ data: account }, { data: teacherRow }] = await Promise.all([
    supabase
      .from("users")
      .select("email")
      .eq("id", current.auth_user_id)
      .maybeSingle(),
    payload.teacherId
      ? supabase
          .from("teachers")
          .select("email")
          .eq("id", payload.teacherId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const previousEmail = String(
    teacherRow?.email || account?.email || ""
  )
    .trim()
    .toLowerCase();

  if (email && email !== previousEmail) {
    const emailResult = await updateManagedUserEmail({
      authUserId: current.auth_user_id,
      email,
    });
    if (emailResult.error) return emailResult;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      is_active: isActive,
    })
    .eq("id", profileId)
    .select("id, auth_user_id, full_name, role, is_active")
    .single();

  if (profileError) return { data: null, error: profileError };

  if (payload.teacherId) {
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? "";
    const lastName =
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : firstName;
    const middleName =
      nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null;

    const teacherPatch = {
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
      status: teacherStatus,
    };
    if (email) teacherPatch.email = email;
    if (learningArea) teacherPatch.learning_area = learningArea;
    if (phone && phone !== "—") teacherPatch.contact_number = phone;

    const { error: teacherError } = await supabase
      .from("teachers")
      .update(teacherPatch)
      .eq("id", payload.teacherId);

    if (teacherError) return { data: null, error: teacherError };
  }

  return { data: profile, error: null };
}

export async function resetManagedUserPassword({ authUserId, temporaryPassword }) {
  const admin = await requireAdmin("reset user passwords");
  if (!admin.ok) return { data: null, error: admin.error };

  if (!authUserId) {
    return { data: null, error: new Error("User auth id is required.") };
  }

  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("admin-reset-password", {
    body: {
      authUserId,
      temporaryPassword: temporaryPassword || undefined,
    },
  });

  if (error) return { data: null, error };
  if (!data?.ok) {
    return {
      data: null,
      error: new Error(data?.error || "Unable to reset password."),
    };
  }

  return {
    data: {
      temporaryPassword: data.temporaryPassword,
      user: data.user,
    },
    error: null,
  };
}

export async function toggleManagedUserStatus(user) {
  const admin = await requireAdmin("update user status");
  if (!admin.ok) return { data: null, error: admin.error };

  if (!user?.id) {
    return { data: null, error: new Error("User id is required.") };
  }

  const nextActive = user.status !== "Active";
  const teacherStatus = nextActive ? "active" : "inactive";
  const supabase = createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .update({ is_active: nextActive })
    .eq("id", user.id)
    .select("id, auth_user_id, full_name, role, is_active")
    .single();

  if (profileError) return { data: null, error: profileError };

  if (user.teacherId) {
    const { error: teacherError } = await supabase
      .from("teachers")
      .update({ status: teacherStatus })
      .eq("id", user.teacherId);
    if (teacherError) return { data: null, error: teacherError };
  }

  return { data: profile, error: null };
}

export { titleCase };
