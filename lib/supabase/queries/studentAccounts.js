import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/supabase/queries/adminAuth";

/** Must match Edge Function pilot cap. */
export const STUDENT_INVITE_BULK_MAX = 50;

export const STUDENT_INVITE_CSV_TEMPLATE = `student_number,email,name
2024-0001,parent1@example.com,Juan Dela Cruz
2024-0002,parent2@example.com,Maria Santos
`;

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function studentFullName(row) {
  return [row?.first_name, row?.middle_name, row?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function invokeAdminFunction(name, body) {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (data && data.ok === false) {
    return {
      data: null,
      error: new Error(data.error || "Unable to complete this request."),
    };
  }

  if (error) {
    let message = error.message || "Unable to complete this request.";
    try {
      const payload = await error.context?.json?.();
      if (payload?.error) message = payload.error;
    } catch {
      /* keep invoke message */
    }
    return { data: null, error: new Error(message) };
  }

  return { data, error: null };
}

/**
 * List learners for HT Student Accounts tab (admin-only via requireAdmin + page).
 * Email shown only when a portal account is linked (from public.users).
 */
export async function getManagedStudentAccounts() {
  const admin = await requireAdmin("manage student accounts");
  if (!admin.ok) return { data: null, error: admin.error };

  const supabase = createClient();
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select(
      "id, student_number, first_name, middle_name, last_name, status, user_id, created_at, section_id, sections(grade_level, section_name)"
    )
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (studentsError) return { data: null, error: studentsError };

  const authIds = [
    ...new Set(
      (students ?? [])
        .map((row) => row.user_id)
        .filter(Boolean)
        .map(String)
    ),
  ];

  const accountById = new Map();
  const profileByAuth = new Map();

  if (authIds.length) {
    const [{ data: accounts }, { data: profiles }] = await Promise.all([
      supabase.from("users").select("id, email, status").in("id", authIds),
      supabase
        .from("profiles")
        .select("id, auth_user_id, is_active, role")
        .in("auth_user_id", authIds)
        .eq("role", "student"),
    ]);
    for (const row of accounts ?? []) accountById.set(row.id, row);
    for (const row of profiles ?? []) profileByAuth.set(row.auth_user_id, row);
  }

  const rows = (students ?? []).map((student) => {
    const fullName = studentFullName(student) || "—";
    const linked = Boolean(student.user_id);
    const account = linked ? accountById.get(student.user_id) : null;
    const profile = linked ? profileByAuth.get(student.user_id) : null;
    const active =
      linked &&
      profile?.is_active !== false &&
      String(account?.status ?? "active").toLowerCase() === "active";
    const section = Array.isArray(student.sections)
      ? student.sections[0]
      : student.sections;
    const gradeLabel =
      section?.grade_level != null && section?.grade_level !== ""
        ? `Grade ${section.grade_level}`
        : null;
    const sectionName = section?.section_name || null;
    const gradeSection =
      [gradeLabel, sectionName].filter(Boolean).join(" · ") || "—";

    return {
      id: student.id,
      studentId: student.id,
      studentNumber: student.student_number || "—",
      fullName,
      initials: initials(fullName),
      email: account?.email || "",
      linked,
      linkLabel: linked ? "Linked" : "Not linked",
      authUserId: student.user_id || null,
      profileId: profile?.id ?? null,
      status: !linked ? "—" : active ? "Active" : "Inactive",
      learnerStatus: student.status || "active",
      gradeLevel: gradeLabel,
      sectionName,
      gradeSection,
    };
  });

  const linkedCount = rows.filter((row) => row.linked).length;

  return {
    data: {
      students: rows,
      counts: {
        total: rows.length,
        linked: linkedCount,
        unlinked: rows.length - linkedCount,
      },
    },
    error: null,
  };
}

/** Search unlinked learners for single create (client already has list; helper for refresh). */
export async function searchUnlinkedStudents(query = "") {
  const result = await getManagedStudentAccounts();
  if (result.error) return result;
  const q = String(query ?? "").trim().toLowerCase();
  const unlinked = (result.data.students ?? []).filter((row) => !row.linked);
  if (!q) return { data: unlinked.slice(0, 40), error: null };
  return {
    data: unlinked
      .filter((row) => {
        const hay = `${row.fullName} ${row.studentNumber}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40),
    error: null,
  };
}

export async function createStudentPortalAccount({ studentId, email }) {
  const admin = await requireAdmin("create student accounts");
  if (!admin.ok) return { data: null, error: admin.error };

  const invoked = await invokeAdminFunction("admin-create-student-user", {
    action: "create",
    studentId,
    email,
  });
  if (invoked.error) return invoked;
  if (!invoked.data?.ok) {
    return {
      data: null,
      error: new Error(invoked.data?.error || "Unable to create student account."),
    };
  }
  return { data: invoked.data, error: null };
}

export async function bulkInviteStudentAccounts(rows) {
  const admin = await requireAdmin("bulk invite student accounts");
  if (!admin.ok) return { data: null, error: admin.error };

  const invoked = await invokeAdminFunction("admin-create-student-user", {
    action: "bulk",
    rows,
  });
  if (invoked.error) return invoked;
  if (!invoked.data?.ok) {
    return {
      data: null,
      error: new Error(invoked.data?.error || "Unable to run bulk invite."),
    };
  }
  return { data: invoked.data, error: null };
}

export async function toggleStudentPortalAccountStatus(student) {
  const admin = await requireAdmin("update student account status");
  if (!admin.ok) return { data: null, error: admin.error };

  if (!student?.studentId && !student?.id) {
    return { data: null, error: new Error("Student id is required.") };
  }
  if (!student?.linked || !student?.authUserId) {
    return {
      data: null,
      error: new Error("Only linked student accounts can be activated or deactivated."),
    };
  }

  const nextActive = student.status !== "Active";
  const invoked = await invokeAdminFunction("admin-create-student-user", {
    action: "setStatus",
    studentId: student.studentId || student.id,
    active: nextActive,
  });
  if (invoked.error) return invoked;
  if (!invoked.data?.ok) {
    return {
      data: null,
      error: new Error(invoked.data?.error || "Unable to update student status."),
    };
  }
  return { data: invoked.data, error: null };
}

/**
 * Parse bulk invite CSV text into rows.
 * Expected headers: student_number (or lrn), email, optional name.
 */
export function parseStudentInviteCsv(text) {
  const lines = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], error: new Error("CSV needs a header row and at least one data row.") };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idxNumber = header.findIndex((h) =>
    ["student_number", "studentnumber", "lrn", "learner_reference_number"].includes(h)
  );
  const idxEmail = header.findIndex((h) => h === "email" || h === "e-mail");
  const idxName = header.findIndex((h) =>
    ["name", "full_name", "fullname", "student_name"].includes(h)
  );

  if (idxNumber < 0 || idxEmail < 0) {
    return {
      rows: [],
      error: new Error("CSV must include student_number (or lrn) and email columns."),
    };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const student_number = (cols[idxNumber] ?? "").trim();
    const email = (cols[idxEmail] ?? "").trim();
    const name = idxName >= 0 ? (cols[idxName] ?? "").trim() : "";
    if (!student_number && !email) continue;
    rows.push({ student_number, email, name });
  }

  if (!rows.length) {
    return { rows: [], error: new Error("No data rows found in CSV.") };
  }
  if (rows.length > STUDENT_INVITE_BULK_MAX) {
    return {
      rows: [],
      error: new Error(
        `Bulk invite is limited to ${STUDENT_INVITE_BULK_MAX} rows per upload (pilot).`
      ),
    };
  }

  return { rows, error: null };
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function downloadStudentInviteTemplate() {
  const blob = new Blob([STUDENT_INVITE_CSV_TEMPLATE], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "cnhs-student-invite-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
