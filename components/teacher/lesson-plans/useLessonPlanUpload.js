"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  UPLOAD_STORAGE_KEY,
  lessonPlansData,
} from "@/data/teacher/lessonPlans";
import { getCurrentTeacherSession, getTeacherClasses } from "@/lib/supabase/queries/myClasses";
import {
  createLessonPlan,
  uploadLessonPlanFile,
} from "@/lib/supabase/queries/lessonPlans";
import { mapClassRecord } from "@/lib/teacher/myClassesMappers";
import {
  buildReviewTimeline,
  mapClassToLessonSelectedClass,
  quarterFromLabel,
  trackingNumberFromId,
} from "@/lib/teacher/lessonPlanMappers";
import {
  clearPendingLessonPlanFile,
  getPendingLessonPlanFile,
  setPendingLessonPlanFile,
} from "@/lib/teacher/lessonPlanUploadStore";

const initialState = {
  step: 1,
  classId: null,
  // Snapshot of the resolved class, persisted so later steps (preview/submit)
  // have it on first render instead of waiting for the Supabase fetch again.
  selectedClassSnapshot: null,
  information: {
    ...lessonPlansData.uploadDefaults,
  },
  file: null,
  submittedAt: null,
  trackingNumber: null,
  submittedPlanId: null,
  status: "Pending Review",
};

function readStorage() {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.sessionStorage.getItem(UPLOAD_STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return {
      ...initialState,
      ...parsed,
      information: {
        ...lessonPlansData.uploadDefaults,
        ...(parsed.information ?? {}),
      },
    };
  } catch {
    return initialState;
  }
}

function writeStorage(next) {
  if (typeof window === "undefined") return;
  const { ...serializable } = next;
  window.sessionStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(serializable));
}

export function useLessonPlanUpload() {
  const searchParams = useSearchParams();
  const urlClassId = searchParams?.get("classId")?.trim() || null;

  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [classes, setClasses] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classError, setClassError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const stored = readStorage();
    // Prefer ?classId= from My Classes quick action over stale session storage.
    if (urlClassId) {
      const next = {
        ...stored,
        classId: urlClassId,
        selectedClassSnapshot:
          stored.selectedClassSnapshot?.id === urlClassId
            ? stored.selectedClassSnapshot
            : null,
        step: stored.step || 1,
      };
      writeStorage(next);
      setState(next);
    } else {
      setState(stored);
    }
    setHydrated(true);
    // Only apply URL classId on first hydrate so the class dropdown stays editable.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot hydrate
  }, []);

  useEffect(() => {
    let active = true;

    async function loadClasses({ silent = false } = {}) {
      if (!silent) {
        setLoadingClasses(true);
        setClassError("");
      }

      const session = await getCurrentTeacherSession();
      if (!active) return;

      if (session.error || !session.data) {
        setClassError(session.error?.message ?? "Unable to load teacher session.");
        setClasses([]);
        setLoadingClasses(false);
        return;
      }

      setTeacher(session.data.teacher);
      const classesResult = await getTeacherClasses(session.data.teacherId);
      if (!active) return;

      if (classesResult.error) {
        setClassError(classesResult.error.message);
        setClasses([]);
        setLoadingClasses(false);
        return;
      }

      const mapped = (classesResult.data ?? []).map(mapClassRecord);
      setClasses(mapped);

      if (!mapped.length) {
        setClassError(
          "No assigned classes found for this teacher account. Open My Classes or ask an administrator to assign a class."
        );
        setState((prev) => {
          if (!prev.classId && !prev.selectedClassSnapshot) return prev;
          const next = { ...prev, classId: null, selectedClassSnapshot: null };
          writeStorage(next);
          return next;
        });
        setLoadingClasses(false);
        return;
      }

      setClassError("");
      setState((prev) => {
        const preferredId =
          urlClassId && mapped.some((item) => item.id === urlClassId)
            ? urlClassId
            : null;
        const stillValid = mapped.some((item) => item.id === prev.classId);
        // Prefer stored/hydrated selection; fall back to ?classId= then first class.
        const nextClassId = stillValid
          ? prev.classId
          : preferredId ?? mapped[0].id;
        if (nextClassId === prev.classId) return prev;
        const next = {
          ...prev,
          classId: nextClassId,
          selectedClassSnapshot: null,
        };
        writeStorage(next);
        return next;
      });

      setLoadingClasses(false);
    }

    loadClasses();

    function onFocus() {
      loadClasses({ silent: true });
    }
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [urlClassId]);

  const teacherName = useMemo(() => {
    if (!teacher) return "";
    return [teacher.first_name, teacher.middle_name, teacher.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
  }, [teacher]);

  const resolvedClass = useMemo(() => {
    if (!classes.length) return null;
    const match =
      classes.find((item) => item.id === state.classId) ?? classes[0] ?? null;
    if (!match) return null;
    return mapClassToLessonSelectedClass(match, teacherName);
  }, [classes, state.classId, teacherName]);

  // The Supabase class fetch restarts on every route change, so steps 2–3 would
  // otherwise render with no class at all. The snapshot bridges that gap.
  const selectedClass = resolvedClass ?? state.selectedClassSnapshot ?? null;

  useEffect(() => {
    if (!resolvedClass) return;
    setState((prev) => {
      const snapshot = prev.selectedClassSnapshot;
      if (
        snapshot?.id === resolvedClass.id &&
        snapshot?.teacherDisplay === resolvedClass.teacherDisplay &&
        snapshot?.quarter === resolvedClass.quarter &&
        snapshot?.schoolYear === resolvedClass.schoolYear
      ) {
        return prev;
      }
      const next = {
        ...prev,
        classId: resolvedClass.id,
        selectedClassSnapshot: resolvedClass,
      };
      writeStorage(next);
      return next;
    });
  }, [resolvedClass]);

  // Ready = storage hydrated AND either we already have a class to show or the
  // class fetch has settled (so callers can redirect / show an empty state).
  const ready = hydrated && (Boolean(selectedClass) || !loadingClasses);

  const update = useCallback((partial) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      writeStorage(next);
      return next;
    });
  }, []);

  const updateInformation = useCallback((fields) => {
    setState((prev) => {
      const next = {
        ...prev,
        information: { ...prev.information, ...fields },
      };
      writeStorage(next);
      return next;
    });
  }, []);

  const setSelectedClassId = useCallback((classId) => {
    setState((prev) => {
      const next = { ...prev, classId };
      writeStorage(next);
      return next;
    });
  }, []);

  const setFile = useCallback((fileMeta, fileObject = null) => {
    if (fileObject) setPendingLessonPlanFile(fileObject);
    if (!fileMeta) clearPendingLessonPlanFile();

    setState((prev) => {
      const next = { ...prev, file: fileMeta };
      writeStorage(next);
      return next;
    });
  }, []);

  const clearUpload = useCallback(() => {
    clearPendingLessonPlanFile();
    writeStorage(initialState);
    setState(initialState);
    setSubmitError("");
  }, []);

  const submitLessonPlan = useCallback(async () => {
    setSubmitting(true);
    setSubmitError("");

    try {
      const session = await getCurrentTeacherSession();
      if (session.error || !session.data) {
        throw session.error ?? new Error("Teacher session required.");
      }

      const current = readStorage();
      const classItem =
        classes.find((item) => item.id === current.classId) ??
        classes[0] ??
        current.selectedClassSnapshot;
      if (!classItem?.id) {
        throw new Error("Select an assigned class before submitting.");
      }

      const info = current.information ?? {};
      if (!info.lessonTitle?.trim() || !info.weekCovered?.trim()) {
        throw new Error("Lesson title and week covered are required.");
      }

      const pendingFile = getPendingLessonPlanFile();
      if (!pendingFile && !current.file) {
        throw new Error("Please upload a lesson plan file before submitting.");
      }
      if (!pendingFile) {
        throw new Error(
          "The selected file is no longer in memory. Please re-upload the file, then submit."
        );
      }

      const upload = await uploadLessonPlanFile({
        teacherId: session.data.teacherId,
        schoolYear: classItem.schoolYear,
        file: pendingFile,
      });
      if (upload.error) throw upload.error;

      const quarter =
        Number(classItem.quarterNumber) ||
        Number(String(classItem.quarter ?? "").replace(/\D/g, "")) ||
        quarterFromLabel(classItem.quarterLabel) ||
        1;

      const created = await createLessonPlan({
        teacher_id: session.data.teacherId,
        class_id: classItem.id,
        lesson_title: info.lessonTitle.trim(),
        week_covered: info.weekCovered.trim(),
        learning_competency: info.learningCompetency?.trim() || null,
        school_year: classItem.schoolYear,
        quarter,
        file_name: upload.data.file_name,
        file_path: upload.data.path,
        file_size: upload.data.file_size,
        file_type: upload.data.file_type,
        status: "Pending Review",
      });
      if (created.error) throw created.error;

      const submittedAt = new Date().toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const trackingNumber = trackingNumberFromId(created.data.id);
      const next = {
        ...current,
        step: 4,
        submittedAt,
        trackingNumber,
        submittedPlanId: created.data.id,
        status: "Pending Review",
        timeline: buildReviewTimeline("Pending Review"),
      };
      writeStorage(next);
      setState(next);
      clearPendingLessonPlanFile();
      setSubmitting(false);
      return next;
    } catch (error) {
      setSubmitError(error?.message ?? "Failed to submit lesson plan.");
      setSubmitting(false);
      throw error;
    }
  }, [classes]);

  return {
    state,
    hydrated,
    ready,
    update,
    updateInformation,
    setFile,
    clearUpload,
    submitLessonPlan,
    selectedClass,
    classes,
    setSelectedClassId,
    loadingClasses,
    classError,
    submitting,
    submitError,
    teacher,
  };
}
