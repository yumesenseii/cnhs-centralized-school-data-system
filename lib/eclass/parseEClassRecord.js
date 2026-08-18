import { parseEClassRecordInWorker } from "@/lib/eclass/parseEClassInWorker";

function logParseProfile(timings = {}, context = "parse") {
  if (!timings) return;
  console.group(`[E-Class Import] Profile (${context})`);
  console.log(`Workbook opened: ${timings.workbookOpenedMs ?? 0}ms`);
  console.log(`INPUT DATA parsed: ${timings.inputDataParsedMs ?? 0}ms`);
  console.log(`TERM parsed: ${timings.termParsedMs ?? 0}ms`);
  if (timings.supabaseInsertMs != null) {
    console.log(`Supabase insert: ${timings.supabaseInsertMs}ms`);
  }
  console.log(`Total import time: ${timings.totalMs ?? 0}ms`);
  console.groupEnd();
}

/**
 * Parse a DepEd Junior High School Electronic Class Record.
 * Excel work happens in a Web Worker; the main thread only receives results.
 */
export async function parseEClassRecord(file, options = {}) {
  const fromAssigned =
    Number(String(options.assignedClass?.quarter ?? "").replace(/\D/g, "")) ||
    Number(
      String(options.assignedClass?.currentQuarter ?? "").replace(/\D/g, "")
    ) ||
    null;

  const quarter = options.quarter ?? fromAssigned;

  const result = await parseEClassRecordInWorker(
    file,
    {
      ...options,
      quarter,
      arrayBuffer: options.arrayBuffer,
      // Preview only needs metadata + validation; skip TERM for snappy UI.
      includeGrades: options.includeGrades === true,
    },
    options.onProgress
  );

  if (result?.timings) {
    logParseProfile(result.timings, options.includeGrades ? "full" : "preview");
  }

  if (result?.ok) {
    console.group("[E-Class Import] Debug");
    console.log("Detected worksheet names:", result.worksheetNames);
    console.log("Extracted metadata:", result.metadata);
    console.log("Teacher:", result.metadata?.teacher_name ?? null);
    console.log("Grade:", result.metadata?.grade_level ?? null);
    console.log("Section:", result.metadata?.section ?? null);
    console.log("Subject:", result.metadata?.subject ?? null);
    console.log("School Year:", result.metadata?.school_year ?? null);
    console.log("Number of learners found:", result.learners?.length ?? 0);
    console.log("Number of grades found per worksheet:", result.gradeCounts ?? {});
    console.groupEnd();
  } else if (result?.error) {
    console.warn("[E-Class Import]", result.error);
  }

  return {
    ok: Boolean(result?.ok),
    sheetName: result?.sheetName ?? null,
    worksheetNames: result?.worksheetNames ?? [],
    metadata: result?.metadata ?? null,
    learners: result?.learners ?? [],
    grades: result?.grades ?? [],
    gradesAttached: result?.gradesAttached ?? 0,
    gradeCounts: result?.gradeCounts ?? {},
    validation: result?.validation ?? null,
    timings: result?.timings ?? null,
    error: result?.error ?? null,
  };
}
