"use client";

import { cn } from "@/lib/utils";

export function fmtAttendance(n, suffix = "") {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return `${text}${suffix}`;
}

export function AttendanceKpi({
  label,
  value,
  hint,
  tone = "bg-slate-50 text-slate-500",
}) {
  return (
    <div className="relative min-w-0 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-900">
        {value ?? "—"}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[10px] text-slate-400">{hint}</p>
      ) : null}
      <span
        className={cn(
          "absolute right-2 top-2 h-6 w-6 rounded-md opacity-80",
          tone
        )}
        aria-hidden
      />
    </div>
  );
}

export function AttendanceMfTable({ breakdown }) {
  if (!breakdown?.absences) return null;
  const rows = [
    ["Absences", breakdown.absences],
    ["First Friday", breakdown.firstFriday],
    ["Late", breakdown.late],
    ["End of month", breakdown.endOfMonth],
    ["ADA", breakdown.ada],
    ["PA", breakdown.pa],
  ];
  return (
    <div className="mt-1.5 overflow-hidden rounded-lg">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="bg-slate-50">
            {["Metric", "M", "F", "Total"].map((h) => (
              <th
                key={h}
                className="px-2 py-1.5 font-semibold text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, triple]) => (
            <tr key={label} className="border-t border-slate-100">
              <td className="px-2 py-1.5 text-slate-600">{label}</td>
              <td className="px-2 py-1.5 font-semibold">
                {fmtAttendance(triple?.m)}
              </td>
              <td className="px-2 py-1.5 font-semibold">
                {fmtAttendance(triple?.f)}
              </td>
              <td className="px-2 py-1.5 font-semibold">
                {fmtAttendance(triple?.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AttendanceFlags({ row }) {
  if (!row) return null;
  return (
    <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
        5 consec {fmtAttendance(row.fiveConsecutive)}
      </span>
      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
        NLS {fmtAttendance(row.nls)}
      </span>
      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
        TO {fmtAttendance(row.transferredOut)}
      </span>
      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
        TI {fmtAttendance(row.transferredIn)}
      </span>
    </div>
  );
}

export function sectionStatus(row) {
  if (!row) return { label: "—", tone: "bg-slate-100 text-slate-500" };
  if (row.nls > 0 || row.fiveConsecutive > 0) {
    return { label: "Attention", tone: "bg-red-50 text-red-600" };
  }
  if (row.pa != null && row.pa < 90) {
    return { label: "Low PA", tone: "bg-amber-50 text-amber-700" };
  }
  if (row.transferredOut > 0) {
    return { label: "Movement", tone: "bg-orange-50 text-cnhs-orange" };
  }
  return { label: "OK", tone: "bg-green-50 text-cnhs-green-dark" };
}

export async function runSf2CompImport({
  file,
  schoolYear,
  sectionId,
  importSf2CompAttendance,
  createClient,
}) {
  const buffer = await file.arrayBuffer();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let profileId = null;
  let teacherId = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    profileId = profile?.id ?? null;
    if (profile?.role === "teacher") {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      teacherId = teacher?.id ?? null;
    }
  }
  return importSf2CompAttendance({
    fileBuffer: buffer,
    fileName: file.name,
    sectionId: sectionId || null,
    schoolYear,
    teacherId,
    profileId,
  });
}
