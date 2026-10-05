import * as XLSX from "xlsx";

/**
 * DepEd Phil-IRI GST Screening Test Interpretation Rules (40 items):
 * 0 to 15: Below GST Benchmark -> Candidate for Individual Phil-IRI Assessment & ARAL Reading
 * 16 to 27: Instructional Screening Band
 * 28 to 40: Meets Benchmark -> No Phil-IRI testing required
 */
export function interpretPhilIriGstScore(totalScore) {
  const score = Number(totalScore);
  if (!Number.isFinite(score) || score < 0) {
    return {
      rawScore: null,
      interpretation: "Pending GST Assessment",
      gstBand: "Pending",
      candidateStatus: "For Review",
      isCandidate: false,
    };
  }

  if (score >= 28) {
    return {
      rawScore: score,
      interpretation: "Meets GST Benchmark (Score 28-40)",
      gstBand: "28 to 40 (Meets Benchmark)",
      candidateStatus: "Not Currently Eligible",
      isCandidate: false,
    };
  }

  if (score >= 16) {
    return {
      rawScore: score,
      interpretation: "Instructional Screening Band (Score 16-27)",
      gstBand: "16 to 27 (Instructional Screening)",
      candidateStatus: "For Review",
      isCandidate: false,
    };
  }

  return {
    rawScore: score,
    interpretation: "Below GST Benchmark (Score 0-15 - Requires Individual Assessment)",
    gstBand: "0 to 15 (Below Benchmark)",
    candidateStatus: "ARAL Candidate",
    isCandidate: true,
  };
}

/**
 * DepEd Phil-IRI Individual Reading Assessment Classification
 * (Stage 2 - Oral Reading Profile / Form 3)
 * Frustration | Instructional | Independent
 */
export function parseIndividualReadingLevel(rawLevel) {
  if (!rawLevel) return null;
  const str = String(rawLevel).toLowerCase().trim();
  if (str.includes("frustrat")) return "Frustration";
  if (str.includes("instruct")) return "Instructional";
  if (str.includes("independ")) return "Independent";
  return null;
}

/**
 * Decoupled helper preserving separation between GST Screening and Individual Reading Assessment.
 * Does not conflate raw GST scores with Individual Reading Level classifications.
 */
export function interpretPhilIriScore(totalScore, explicitReadingLevel = null) {
  const gst = interpretPhilIriGstScore(totalScore);
  const parsedIndividualLevel = parseIndividualReadingLevel(explicitReadingLevel);

  // If explicit Form 3 / Oral reading level is present, use it.
  // Otherwise, default to "Pending Oral Profile" (for candidate) or "Not Required" / "Pending"
  const readingLevel =
    parsedIndividualLevel ||
    (gst.isCandidate
      ? "Pending Oral Profile"
      : gst.rawScore != null
      ? "Independent"
      : "Pending");

  return {
    rawScore: gst.rawScore,
    interpretation: gst.interpretation,
    gstBand: gst.gstBand,
    readingLevel: readingLevel,
    candidateStatus: gst.candidateStatus,
    isCandidate: gst.isCandidate,
  };
}

/**
 * Normalizes string for name matching
 */
function cleanString(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Normalizes name tokens
 */
function nameTokens(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Matches an imported row with the teacher's enrolled student roster
 */
export function matchStudentToRoster(row, enrolledStudents = []) {
  if (!enrolledStudents.length) {
    return { matched: false, student: null, matchType: "none" };
  }

  // 1. Try exact LRN / Student Number match if provided
  const rowLrn = String(row.lrn || row.studentNumber || row.studentId || "").trim();
  if (rowLrn) {
    const lrnMatch = enrolledStudents.find(
      (s) =>
        s.studentNumber &&
        String(s.studentNumber).trim().toLowerCase() === rowLrn.toLowerCase()
    );
    if (lrnMatch) {
      return { matched: true, student: lrnMatch, matchType: "lrn" };
    }
  }

  // 2. Try normalized full name match
  const rawRowName = row.studentName || row.name || `${row.lastName || ""} ${row.firstName || ""}`;
  const rowTokens = nameTokens(rawRowName);

  if (rowTokens.length) {
    // Exact full name match
    const exactClean = cleanString(rawRowName);
    const exactMatch = enrolledStudents.find((s) => {
      const sFull = cleanString(s.name || `${s.lastName || ""} ${s.firstName || ""}`);
      return sFull && (sFull === exactClean || sFull.includes(exactClean) || exactClean.includes(sFull));
    });

    if (exactMatch) {
      return { matched: true, student: exactMatch, matchType: "exact_name" };
    }

    // Token overlap match (handles "Last, First" vs "First Last")
    for (const s of enrolledStudents) {
      const sTokens = nameTokens(s.name || `${s.lastName || ""} ${s.firstName || ""}`);
      const matches = rowTokens.filter((token) => sTokens.includes(token));
      // If at least 2 tokens match or 100% of tokens match
      if (matches.length >= Math.min(2, rowTokens.length)) {
        // Double check section/grade if present
        if (row.gradeLevel && s.grade) {
          const rowG = String(row.gradeLevel).replace(/\D/g, "");
          const sG = String(s.grade).replace(/\D/g, "");
          if (rowG && sG && rowG !== sG) continue;
        }
        return { matched: true, student: s, matchType: "fuzzy_name" };
      }
    }
  }

  return { matched: false, student: null, matchType: "none" };
}

/**
 * Parses Phil-IRI Excel file (.xlsx, .xls, or array buffer)
 * Supports DepEd Form 1B and Screening Test Class Reading Record.
 */
export async function parsePhilIriExcel(fileOrBuffer, enrolledStudents = []) {
  let workbook;
  if (fileOrBuffer instanceof ArrayBuffer || ArrayBuffer.isView(fileOrBuffer)) {
    workbook = XLSX.read(fileOrBuffer, { type: "array" });
  } else if (typeof fileOrBuffer.arrayBuffer === "function") {
    const buffer = await fileOrBuffer.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array" });
  } else {
    throw new Error("Invalid file format provided to Phil-IRI parser.");
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The uploaded Excel workbook contains no sheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (!rows || rows.length < 2) {
    throw new Error("The sheet appears to be empty or missing data rows.");
  }

  // Look for header row
  let headerRowIndex = -1;
  let headerMap = {};

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].map((cell) => String(cell || "").toLowerCase().trim());
    const hasName = row.some((c) => c.includes("name") || c.includes("learner") || c.includes("student"));
    const hasScore = row.some((c) => c.includes("score") || c.includes("total") || c.includes("literal") || c.includes("raw"));

    if (hasName && (hasScore || i >= 2)) {
      headerRowIndex = i;
      row.forEach((colName, colIdx) => {
        if (!colName) return;
        if (colName.includes("lrn") || colName.includes("id")) headerMap.lrn = colIdx;
        else if (colName.includes("name") || colName.includes("learner") || colName.includes("student")) headerMap.name = colIdx;
        else if (colName.includes("grade")) headerMap.grade = colIdx;
        else if (colName.includes("section")) headerMap.section = colIdx;
        else if (colName.includes("subject") || colName.includes("area")) headerMap.subject = colIdx;
        else if (colName.includes("literal")) headerMap.literal = colIdx;
        else if (colName.includes("inferential") || colName.includes("infer")) headerMap.inferential = colIdx;
        else if (colName.includes("critical")) headerMap.critical = colIdx;
        else if (colName.includes("total") || colName.includes("raw score") || colName === "score") headerMap.total = colIdx;
        else if (colName.includes("reading level") || colName.includes("result") || colName.includes("status")) headerMap.readingLevel = colIdx;
      });
      break;
    }
  }

  // Fallback defaults if header row detection was partial
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    headerMap = {
      name: 0,
      grade: 1,
      section: 2,
      subject: 3,
      literal: 4,
      inferential: 5,
      critical: 6,
      total: 7,
    };
  }

  const parsedRecords = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    const rawName = headerMap.name !== undefined ? String(row[headerMap.name] || "").trim() : "";
    if (!rawName || rawName.toLowerCase() === "total" || rawName.toLowerCase().startsWith("male") || rawName.toLowerCase().startsWith("female")) {
      continue;
    }

    const lrn = headerMap.lrn !== undefined ? String(row[headerMap.lrn] || "").trim() : "";
    const gradeLevel = headerMap.grade !== undefined ? String(row[headerMap.grade] || "").trim() : "";
    const section = headerMap.section !== undefined ? String(row[headerMap.section] || "").trim() : "";
    const subject = headerMap.subject !== undefined ? String(row[headerMap.subject] || "").trim() : "English";

    const literalScore = headerMap.literal !== undefined && row[headerMap.literal] !== "" ? Number(row[headerMap.literal]) : null;
    const inferentialScore = headerMap.inferential !== undefined && row[headerMap.inferential] !== "" ? Number(row[headerMap.inferential]) : null;
    const criticalScore = headerMap.critical !== undefined && row[headerMap.critical] !== "" ? Number(row[headerMap.critical]) : null;

    let totalScore = null;
    if (headerMap.total !== undefined && row[headerMap.total] !== "") {
      totalScore = Number(row[headerMap.total]);
    } else if (literalScore != null || inferentialScore != null || criticalScore != null) {
      totalScore = (literalScore || 0) + (inferentialScore || 0) + (criticalScore || 0);
    }

    const rawReadingLevel = headerMap.readingLevel !== undefined ? String(row[headerMap.readingLevel] || "").trim() : "";
    const interpretation = interpretPhilIriScore(totalScore, rawReadingLevel);

    const matchResult = matchStudentToRoster(
      { lrn, studentName: rawName, gradeLevel, section, subject },
      enrolledStudents
    );

    // 4-tier validation categorization:
    let validationStatus = "unmatched";
    if (matchResult.matched) {
      if (matchResult.matchType === "lrn" || matchResult.matchType === "exact_name") {
        validationStatus = "matched";
      } else {
        validationStatus = "needs_verification";
      }
    }

    parsedRecords.push({
      tempId: `imported-${r}`,
      lrn: lrn || matchResult.student?.studentNumber || "",
      studentName: rawName,
      gradeLevel: gradeLevel || matchResult.student?.grade || "",
      section: section || matchResult.student?.section || "",
      subject: subject || matchResult.student?.subject || "English",
      testTaken: "GST Form 1B",
      literalScore,
      inferentialScore,
      criticalScore,
      totalScore,
      gstScore: totalScore,
      gstBand: interpretation.gstBand,
      readingLevel: interpretation.readingLevel,
      screeningInterpretation: interpretation.interpretation,
      candidateStatus: interpretation.candidateStatus,
      isCandidate: interpretation.isCandidate,
      isMatched: matchResult.matched,
      matchedStudent: matchResult.student,
      matchType: matchResult.matchType,
      validationStatus,
      studentId: matchResult.student?.studentId || matchResult.student?.id || null,
      classId: matchResult.student?.classId || null,
    });
  }

  // Detect duplicates within the batch
  const seenIds = new Set();
  parsedRecords.forEach((rec) => {
    if (rec.studentId) {
      if (seenIds.has(rec.studentId)) {
        rec.validationStatus = "duplicate";
        rec.isDuplicate = true;
      } else {
        seenIds.add(rec.studentId);
      }
    }
  });

  const matchedCount = parsedRecords.filter((r) => r.validationStatus === "matched").length;
  const needsVerificationCount = parsedRecords.filter((r) => r.validationStatus === "needs_verification").length;
  const unmatchedCount = parsedRecords.filter((r) => r.validationStatus === "unmatched").length;
  const duplicateCount = parsedRecords.filter((r) => r.validationStatus === "duplicate").length;

  return {
    records: parsedRecords,
    summary: {
      totalFound: parsedRecords.length,
      matchedCount,
      needsVerificationCount,
      unmatchedCount,
      duplicateCount,
    },
  };
}

