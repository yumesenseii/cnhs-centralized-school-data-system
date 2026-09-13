import {
  extractMetadata,
  findInputDataSheetName,
  parseInputDataFromSheet,
} from "@/lib/eclass/parseInputData";
import {
  attachAssignedTermGrades,
  attachTermComponentScores,
  attachTermGradesBySourceRow,
  buildRosterFromTermSheet,
  findTermSheetName,
  parseAssignedTermSheet,
  resolveAssignedQuarter,
  TERM_SPECS,
} from "@/lib/eclass/parseAssignedTerm";
import {
  backfillLrnFromInputData,
  extractAveMetadata,
  findAveSheetName,
  mergeEcrMetadata,
  mergeMultiTermGradesOntoLearners,
  parseAveRoster,
} from "@/lib/eclass/parseAveSheet";
import { findTransmutationTable } from "@/lib/eclass/depedTransmutation";
import { normalizeKey } from "@/lib/eclass/normalize";
import { validateEClassAgainstAssignedClass } from "@/lib/eclass/validateEClassMetadata";
import {
  readWorkbookSheetNames,
  readWorkbookSheets,
} from "@/lib/eclass/xlsxRead";

function now() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

function findSummarySheetName(sheetNames = []) {
  return (
    sheetNames.find((name) => {
      const key = normalizeKey(name);
      return (
        key.includes("summary of grades") ||
        key === "summary" ||
        key.includes("summary of quarterly")
      );
    }) ?? null
  );
}

function hasTermSheets(sheetNames = []) {
  return sheetNames.some((name) => {
    const key = normalizeKey(name);
    return (
      key === "term1" ||
      key === "term 1" ||
      key === "term2" ||
      key === "term 2" ||
      key === "term3" ||
      key === "term 3" ||
      key.startsWith("term 1") ||
      key.startsWith("term 2") ||
      key.startsWith("term 3")
    );
  });
}

function metadataComplete(metadata) {
  return Boolean(
    metadata?.teacher_name &&
      metadata?.grade_level &&
      metadata?.section &&
      metadata?.subject &&
      metadata?.school_year
  );
}

function enrichMetadataFromSheets(buffer, worksheetNames, baseMetadata) {
  let metadata = { ...(baseMetadata || {}) };
  if (metadataComplete(metadata)) return metadata;

  const quarter = 1;
  const candidates = [];
  const termInfo = findTermSheetName(worksheetNames, quarter);
  if (termInfo.name) candidates.push(termInfo.name);
  // Also try other term tabs — Class-Record often duplicates header meta.
  for (const q of [2, 3]) {
    const info = findTermSheetName(worksheetNames, q);
    if (info.name && !candidates.includes(info.name)) candidates.push(info.name);
  }
  const summaryName = findSummarySheetName(worksheetNames);
  if (summaryName) candidates.push(summaryName);

  if (!candidates.length) return metadata;

  const book = readWorkbookSheets(buffer, candidates);
  for (const name of candidates) {
    if (metadataComplete(metadata)) break;
    const sheet = book.Sheets[name];
    if (!sheet) continue;
    const extra = extractMetadata(sheet).metadata;
    metadata = mergeEcrMetadata(metadata, extra);
  }

  return metadata;
}

/**
 * DepEd ECR parse (AVE-first for official; TERM-first for Class-Record-v1):
 * 1) INPUT DATA / INPUT → metadata (+ optional LRN map / fallback learners)
 * 2) AVE or SUMMARY OF GRADES → roster + quarter grades when present
 * 3) Class-Record-v1: prefer TERM sheet roster (names OK even if Term Grade empty)
 * 4) validate metadata against assigned class
 * 5) backfill real LRNs from INPUT DATA by name
 */
export function parseEClassRecordBuffer(buffer, options = {}, onProgress) {
  const timings = {
    workbookOpenedMs: 0,
    inputDataParsedMs: 0,
    termParsedMs: 0,
    totalMs: 0,
  };
  const totalStart = now();

  onProgress?.({ label: "Opening workbook...", percent: 5 });
  const openStart = now();
  const worksheetNames = readWorkbookSheetNames(buffer);
  timings.workbookOpenedMs = Math.round(now() - openStart);

  const inputSheetName = findInputDataSheetName(worksheetNames);
  const aveSheetName = findAveSheetName(worksheetNames);
  const classRecordLike = hasTermSheets(worksheetNames);

  if (!inputSheetName && !aveSheetName && !classRecordLike) {
    return {
      ok: false,
      metadata: null,
      learners: [],
      grades: [],
      sheetName: null,
      worksheetNames,
      gradesAttached: 0,
      gradeCounts: {},
      validation: null,
      timings,
      error:
        'Could not find "INPUT DATA", "AVE", or Class Record TERM sheets. Please upload an official DepEd Electronic Class Record or Class-Record-v1 file.',
    };
  }

  onProgress?.({ label: "Reading class metadata...", percent: 15 });
  const inputStart = now();

  let inputLearners = [];
  let inputMetadata = null;
  let inputSheetUsed = inputSheetName;

  if (inputSheetName) {
    const inputBook = readWorkbookSheets(buffer, [inputSheetName]);
    const inputSheet = inputBook.Sheets[inputSheetName];
    const parsedInput = parseInputDataFromSheet(
      inputSheet,
      inputSheetName,
      worksheetNames
    );

    if (parsedInput.ok) {
      inputLearners = parsedInput.learners ?? [];
      inputMetadata = parsedInput.metadata;
    } else if (inputSheet) {
      // Soft fallback: keep metadata even when Male/Female learner parse fails.
      const soft = extractMetadata(inputSheet);
      inputMetadata = soft.metadata;
    }
  }

  let aveMetadata = null;
  let aveRoster = null;

  if (aveSheetName) {
    onProgress?.({ label: "Reading AVE roster & grades...", percent: 35 });
    const aveBook = readWorkbookSheets(buffer, [aveSheetName]);
    const aveSheet = aveBook.Sheets[aveSheetName];
    aveMetadata = extractAveMetadata(aveSheet).metadata;

    const quarter = resolveAssignedQuarter(options);
    const sectionHint =
      options.assignedClass?.section ||
      inputMetadata?.section ||
      aveMetadata?.section ||
      "";

    aveRoster = parseAveRoster(aveSheet, {
      quarter,
      sheetName: aveSheetName,
      section: sectionHint,
    });
  }

  timings.inputDataParsedMs = Math.round(now() - inputStart);

  let metadata = mergeEcrMetadata(inputMetadata, aveMetadata);
  // Class-Record-v1 stores TEACHER / GRADE & SECTION / SUBJECT on TERM tabs.
  if (!metadataComplete(metadata)) {
    onProgress?.({ label: "Reading TERM / SUMMARY metadata...", percent: 40 });
    metadata = enrichMetadataFromSheets(buffer, worksheetNames, metadata);
  }

  if (!metadataComplete(metadata)) {
    timings.totalMs = Math.round(now() - totalStart);
    const missing = [
      !metadata.teacher_name && "TEACHER",
      !metadata.grade_level && "GRADE LEVEL",
      !metadata.section && "SECTION (or GRADE & SECTION)",
      !metadata.subject && "SUBJECT",
      !metadata.school_year && "SCHOOL YEAR",
    ].filter(Boolean);
    return {
      ok: false,
      metadata,
      learners: [],
      grades: [],
      sheetName: inputSheetUsed || aveSheetName,
      worksheetNames,
      gradesAttached: 0,
      gradeCounts: {},
      validation: null,
      timings,
      error: `Missing label:\n${missing.join("\n")}`,
    };
  }

  let validation = null;
  if (options.assignedClass) {
    onProgress?.({ label: "Validating class...", percent: 50 });
    validation = validateEClassAgainstAssignedClass({
      metadata,
      assignedClass: options.assignedClass,
      teacherName: options.teacherName,
    });

    if (!validation.ok) {
      timings.totalMs = Math.round(now() - totalStart);
      return {
        ok: false,
        sheetName: inputSheetUsed || aveSheetName,
        worksheetNames,
        metadata,
        learners: [],
        grades: [],
        gradesAttached: 0,
        gradeCounts: {},
        validation,
        timings,
        error: validation.error,
      };
    }
  }

  const includeGrades = options.includeGrades !== false;
  let learners = [];
  let grades = [];
  let gradesAttached = 0;
  let gradeCounts = {};
  let primarySheetName = aveSheetName || inputSheetUsed;
  const termStart = now();

  // Load DepEd transmute table from Helper / DO NOT DELETE when present.
  const helperNames = worksheetNames.filter((n) =>
    /helper|do not delete/i.test(String(n))
  );
  let transmuteTable = null;
  let transmuteSheetName = null;
  if (helperNames.length) {
    const helperBook = readWorkbookSheets(buffer, helperNames);
    const found = findTransmutationTable(helperBook.Sheets, helperNames);
    transmuteTable = found.table;
    transmuteSheetName = found.sheetName;
  }
  if (!transmuteTable) {
    const found = findTransmutationTable({}, []);
    transmuteTable = found.table;
  }

  // Roster selection:
  // - Class-Record-v1 (TERM1–3 present): prefer TERM over SUMMARY/AVE
  // - Official DepEd ECR: prefer AVE, then TERM, then INPUT
  const quarter = resolveAssignedQuarter(options);
  const termInfo = findTermSheetName(worksheetNames, quarter);

  let termRoster = null;
  if (termInfo.name) {
    onProgress?.({
      label: `Reading ${termInfo.label} roster...`,
      percent: 60,
    });
    const termBook = readWorkbookSheets(buffer, [termInfo.name]);
    termRoster = buildRosterFromTermSheet(termBook.Sheets[termInfo.name], {
      quarter: termInfo.quarter,
      label: termInfo.label,
      sheetName: termInfo.name,
      section: metadata.section || "",
      transmuteTable,
    });
  }

  const useTermRoster =
    termRoster?.ok && (termRoster.learners?.length ?? 0) > 0;
  const useAveRoster =
    aveRoster && (aveRoster.learners?.length ?? 0) > 0;

  const inputCount = inputLearners.length;
  const termCount = termRoster?.learners?.length ?? 0;
  const aveCount = aveRoster?.learners?.length ?? 0;

  // Class-Record: TERM/SUMMARY names are often =INPUT!Bn formulas with no
  // cached values in the saved file. Prefer the richer INPUT roster.
  const preferInputRoster =
    classRecordLike &&
    inputCount > 0 &&
    inputCount > Math.max(termCount, aveCount);

  const preferTermForClassRecord =
    !preferInputRoster &&
    classRecordLike &&
    useTermRoster &&
    (!useAveRoster ||
      termRoster.learners.length >= aveRoster.learners.length ||
      (aveRoster.grades?.length ?? 0) === 0);

  if (preferInputRoster) {
    primarySheetName = inputSheetUsed || primarySheetName;
    learners = inputLearners;

    if (!includeGrades) {
      learners = learners.map((learner) => ({
        ...learner,
        term_grades: {},
        quarterly_grade: null,
        general_average: null,
      }));
      grades = [];
      gradesAttached = 0;
      gradeCounts = { INPUT: 0, learners: learners.length };
    } else {
      onProgress?.({
        label: "Attaching term grades by row (INPUT names)...",
        percent: 68,
      });

      // Attach Term 1–3 from each TERM sheet using INPUT source_row alignment.
      const termSheetNames = [];
      for (const spec of TERM_SPECS) {
        const info = findTermSheetName(worksheetNames, spec.quarter);
        if (info?.name) termSheetNames.push(info.name);
      }
      const uniqueTermSheets = [...new Set(termSheetNames)];
      const termBooks =
        uniqueTermSheets.length > 0
          ? readWorkbookSheets(buffer, uniqueTermSheets)
          : { Sheets: {} };

      gradeCounts = { learners: learners.length };
      for (const spec of TERM_SPECS) {
        const info = findTermSheetName(worksheetNames, spec.quarter);
        if (!info?.name) continue;
        const sheet = termBooks.Sheets[info.name];
        if (!sheet) continue;
        const attached = attachTermGradesBySourceRow(learners, sheet, {
          quarter: info.quarter,
          label: info.label,
          sheetName: info.name,
          transmuteTable,
        });
        learners = attached.learners;
        gradeCounts[info.label] = attached.gradesAttached;
      }

      // Name-match fallback for any remaining gaps (official layouts).
      if (useTermRoster) {
        const byName = attachAssignedTermGrades(learners, termRoster);
        learners = byName.learners;
      }
      // FINAL GRADE (and any missing terms) from official AVE / SUMMARY.
      if (useAveRoster) {
        learners = mergeMultiTermGradesOntoLearners(
          learners,
          aveRoster.learners,
          { preferredQuarter: quarter }
        );
      }

      grades = flattenLearnerTermGrades(learners);
      gradesAttached = learners.filter((l) =>
        Object.keys(l.term_grades ?? {}).length
      ).length;
      gradeCounts = {
        ...gradeCounts,
        multiTermGrades: grades.length,
        gradesAttached,
        transmuteSheet: transmuteSheetName,
        ...(aveRoster?.gradeCountByTerm
          ? { fromAveSummary: aveRoster.gradeCountByTerm }
          : {}),
      };
      primarySheetName =
        termInfo.name || aveSheetName || inputSheetUsed || primarySheetName;
    }
  } else if (preferTermForClassRecord || (!useAveRoster && useTermRoster)) {
    primarySheetName = termInfo.name;
    learners = backfillLrnFromInputData(termRoster.learners, inputLearners);

    if (!includeGrades) {
      learners = learners.map((learner) => ({
        ...learner,
        term_grades: {},
        quarterly_grade: null,
        general_average: null,
      }));
      grades = [];
      gradesAttached = 0;
      gradeCounts = { [termInfo.label]: 0 };
    } else {
      grades = termRoster.grades ?? [];
      gradesAttached = learners.filter(
        (l) => l.quarterly_grade !== null && l.quarterly_grade !== undefined
      ).length;
      gradeCounts = {
        [termInfo.label]: gradesAttached,
        parsedFromSheet: termRoster.gradesCount ?? grades.length,
        learners: learners.length,
      };

      // Fill Term 1–3 + Final from SUMMARY/AVE when present (multi-term import).
      if (useAveRoster) {
        onProgress?.({
          label: "Merging SUMMARY / AVE term grades...",
          percent: 72,
        });
        learners = mergeMultiTermGradesOntoLearners(
          learners,
          aveRoster.learners,
          { preferredQuarter: quarter }
        );
        grades = flattenLearnerTermGrades(learners);
        gradesAttached = learners.filter((l) =>
          Object.keys(l.term_grades ?? {}).length
        ).length;
        gradeCounts = {
          ...gradeCounts,
          ...(aveRoster.gradeCountByTerm ?? {}),
          fromSummaryAve: aveRoster.learners.length,
          multiTermGrades: grades.length,
        };
      }
    }
  } else if (useAveRoster) {
    onProgress?.({ label: "Matching LRNs...", percent: 65 });
    primarySheetName = aveSheetName || primarySheetName;
    learners = backfillLrnFromInputData(aveRoster.learners, inputLearners);

    if (!includeGrades) {
      learners = learners.map((learner) => ({
        ...learner,
        term_grades: {},
        quarterly_grade: null,
        general_average: null,
      }));
      grades = [];
      gradesAttached = 0;
      gradeCounts = { AVE: 0 };
    } else {
      // AVE/SUMMARY already carries Term 1–3 + Final in term_grades.
      grades = aveRoster.grades ?? flattenLearnerTermGrades(learners);
      gradesAttached = learners.filter((l) =>
        Object.keys(l.term_grades ?? {}).length
      ).length;
      gradeCounts = {
        AVE: gradesAttached,
        parsedFromSheet: aveRoster.gradesCount ?? grades.length,
        learners: learners.length,
        ...(aveRoster.gradeCountByTerm ?? {}),
      };

      // Official AVE weak on grades → try TERM attach when available.
      if (
        gradesAttached === 0 &&
        useTermRoster &&
        (termRoster.grades?.length ?? 0) > 0
      ) {
        const attached = attachAssignedTermGrades(learners, termRoster);
        learners = attached.learners;
        grades = attached.grades;
        gradesAttached = attached.gradesAttached;
        gradeCounts = {
          ...attached.gradeCounts,
          learners: learners.length,
        };
        primarySheetName = termInfo.name || primarySheetName;
      }
    }
  } else if (inputLearners.length) {
    learners = inputLearners;
    if (includeGrades) {
      onProgress?.({ label: "Reading grades (fallback)...", percent: 70 });
      const gradeResult = readAssignedQuarterGradesFallback(
        buffer,
        worksheetNames,
        quarter,
        aveSheetName,
        aveRoster
      );
      if (gradeResult) {
        const attached = attachAssignedTermGrades(learners, gradeResult);
        learners = attached.learners;
        grades = attached.grades;
        gradesAttached = attached.gradesAttached;
        gradeCounts = attached.gradeCounts;
        primarySheetName = gradeResult.sheetName || primarySheetName;
      } else {
        gradeCounts = { [`Q${quarter}`]: 0 };
      }
    }
  } else {
    timings.termParsedMs = Math.round(now() - termStart);
    timings.totalMs = Math.round(now() - totalStart);
    return {
      ok: false,
      metadata,
      learners: [],
      grades: [],
      sheetName: termInfo.name || inputSheetUsed || aveSheetName,
      worksheetNames,
      gradesAttached: 0,
      gradeCounts: {},
      validation,
      timings,
      error:
        termRoster?.error ||
        aveRoster?.error ||
        "No learner names were found on AVE, INPUT, or Class Record TERM sheets.",
    };
  }

  if (includeGrades && learners.length) {
    const termSheetNames = [];
    for (const spec of TERM_SPECS) {
      const info = findTermSheetName(worksheetNames, spec.quarter);
      if (info?.name) termSheetNames.push(info);
    }
    const uniqueNames = [...new Set(termSheetNames.map((info) => info.name))];
    if (uniqueNames.length) {
      const termBooks = readWorkbookSheets(buffer, uniqueNames);
      for (const info of termSheetNames) {
        const sheet = termBooks.Sheets[info.name];
        if (!sheet) continue;
        learners = attachTermComponentScores(learners, sheet, {
          quarter: info.quarter,
        });
      }
    }
  }

  timings.termParsedMs = Math.round(now() - termStart);
  timings.totalMs = Math.round(now() - totalStart);

  return {
    ok: true,
    sheetName: primarySheetName,
    worksheetNames,
    metadata,
    learners,
    grades,
    gradesAttached,
    gradeCounts,
    validation,
    timings,
    error: null,
  };
}

function flattenLearnerTermGrades(learners = []) {
  const grades = [];
  for (const learner of learners) {
    const termGrades = learner.term_grades ?? {};
    for (const [q, value] of Object.entries(termGrades)) {
      const quarter = Number(q);
      if (!Number.isFinite(quarter) || !Number.isFinite(Number(value))) continue;
      grades.push({
        full_name: learner.full_name,
        quarter,
        final_grade: Number(value),
      });
    }
  }
  return grades;
}

function readAssignedQuarterGradesFallback(
  buffer,
  worksheetNames,
  quarter,
  aveSheetName,
  aveRoster
) {
  if (aveRoster && (aveRoster.gradesCount > 0 || aveRoster.grades?.length > 0)) {
    return {
      sheetName: aveRoster.sheetName,
      label: "AVE",
      quarter: aveRoster.quarter,
      gradesByName: aveRoster.gradesByName,
      grades: aveRoster.grades,
      count: aveRoster.gradesCount ?? aveRoster.grades.length,
    };
  }

  if (aveSheetName && !aveRoster) {
    const aveBook = readWorkbookSheets(buffer, [aveSheetName]);
    const roster = parseAveRoster(aveBook.Sheets[aveSheetName], {
      quarter,
      sheetName: aveSheetName,
    });
    if (roster.gradesCount > 0) {
      return {
        sheetName: roster.sheetName,
        label: "AVE",
        quarter: roster.quarter,
        gradesByName: roster.gradesByName,
        grades: roster.grades,
        count: roster.gradesCount,
      };
    }
  }

  const termInfo = findTermSheetName(worksheetNames, quarter);
  if (!termInfo.name) return null;

  const termBook = readWorkbookSheets(buffer, [termInfo.name]);
  return parseAssignedTermSheet(termBook.Sheets[termInfo.name], {
    quarter: termInfo.quarter,
    label: termInfo.label,
    sheetName: termInfo.name,
  });
}
