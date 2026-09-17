"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSectionDailyMonth } from "@/lib/supabase/queries/attendanceDaily";
import {
  getCurrentTeacherSession,
  getTeacherClasses,
} from "@/lib/supabase/queries/myClasses";
import { createClient } from "@/lib/supabase/client";
import { todayIsoDateManila } from "@/lib/attendance/sf2Daily";
import Sf2DailyAttendancePanel from "@/components/teacher/attendance/Sf2DailyAttendancePanel";
import { DailySectionMonthPanel } from "@/components/teacher/attendance/DailyMonitoringPanels";

export default function TeacherAttendancePanel({
  refreshToken = 0,
  onRefreshingChange,
}) {
  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDateManila);
  const [dailySummary, setDailySummary] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [error, setError] = useState("");
  const [teacherId, setTeacherId] = useState(null);

  const reviewMonth = Number(String(attendanceDate).slice(5, 7)) || 1;

  const loadSections = useCallback(async () => {
    const session = await getCurrentTeacherSession();
    setTeacherId(session.data?.teacherId ?? null);
    if (session.error || !session.data?.teacherId) {
      const supabase = createClient();
      const { data } = await supabase
        .from("sections")
        .select("id, section_name, grade_level, school_year, adviser_id")
        .order("grade_level");
      const list = data ?? [];
      setSections(list);
      const years = [
        ...new Set(list.map((s) => s.school_year).filter(Boolean)),
      ].sort((a, b) => String(b).localeCompare(String(a)));
      setSchoolYears(years);
      if (years[0]) setSchoolYear(years[0]);
      if (list[0]) setSectionId(list[0].id);
      return;
    }

    const classesResult = await getTeacherClasses(session.data.teacherId);
    const map = new Map();
    for (const cls of classesResult.data ?? []) {
      const sec = Array.isArray(cls.sections) ? cls.sections[0] : cls.sections;
      if (!sec?.id) continue;
      map.set(sec.id, {
        id: sec.id,
        section_name: sec.section_name,
        grade_level: sec.grade_level,
        school_year: cls.school_year || sec.school_year,
        adviser_id: sec.adviser_id ?? null,
      });
    }
    const supabase = createClient();
    const { data: advised } = await supabase
      .from("sections")
      .select("id, section_name, grade_level, school_year, adviser_id")
      .eq("adviser_id", session.data.teacherId);
    for (const sec of advised ?? []) {
      if (!sec?.id || map.has(sec.id)) continue;
      map.set(sec.id, sec);
    }
    const list = [...map.values()];
    setSections(list);
    const years = [
      ...new Set(
        [
          ...list.map((s) => s.school_year),
          ...(classesResult.data ?? []).map((c) => c.school_year),
        ].filter(Boolean)
      ),
    ].sort((a, b) => String(b).localeCompare(String(a)));
    setSchoolYears(years.length ? years : ["SY 2026-2027"]);
    const sy = years[0] || "SY 2026-2027";
    setSchoolYear(sy);
    const preferred =
      list.find((s) => s.school_year === sy) || list[0] || null;
    if (preferred) setSectionId(preferred.id);
  }, []);

  const reloadDaily = useCallback(async () => {
    if (!sectionId || !schoolYear || !reviewMonth) {
      setDailySummary(null);
      return;
    }
    setDailyLoading(true);
    onRefreshingChange?.(true);
    const result = await getSectionDailyMonth({
      sectionId,
      schoolYear,
      month: reviewMonth,
    });
    if (result.error) {
      setError(result.error.message);
      setDailySummary(null);
    } else {
      setError("");
      setDailySummary(result.data);
    }
    setDailyLoading(false);
    onRefreshingChange?.(false);
  }, [sectionId, schoolYear, reviewMonth, onRefreshingChange]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  useEffect(() => {
    if (sectionId && schoolYear) {
      reloadDaily();
    }
  }, [sectionId, schoolYear, reloadDaily]);

  useEffect(() => {
    if (refreshToken > 0) {
      reloadDaily();
    }
  }, [refreshToken, reloadDaily]);

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === sectionId) || null,
    [sections, sectionId]
  );
  const isAdviser = Boolean(
    teacherId && selectedSection?.adviser_id === teacherId
  );

  const sectionOptions = useMemo(
    () =>
      sections.filter(
        (s) => !schoolYear || s.school_year === schoolYear || !s.school_year
      ),
    [sections, schoolYear]
  );

  function requestSectionChange(next) {
    if (next === sectionId) return;
    setSectionId(next);
    setError("");
  }

  function requestSchoolYearChange(next) {
    if (next === schoolYear) return;
    setSchoolYear(next);
    const nextSection = sections.find(
      (s) => s.school_year === next || !s.school_year
    );
    if (nextSection) setSectionId(nextSection.id);
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <Sf2DailyAttendancePanel
        sectionId={sectionId}
        schoolYear={schoolYear}
        schoolYears={schoolYears}
        sections={sectionOptions}
        attendanceDate={attendanceDate}
        onSchoolYearChange={requestSchoolYearChange}
        onSectionChange={requestSectionChange}
        onAttendanceDateChange={setAttendanceDate}
        onSaved={reloadDaily}
        sectionIsAdviser={isAdviser}
      />

      <DailySectionMonthPanel
        loading={dailyLoading}
        summary={dailySummary}
        schoolYear={schoolYear}
        isAdviser={isAdviser}
        onMonthClosed={reloadDaily}
      />
    </div>
  );
}
