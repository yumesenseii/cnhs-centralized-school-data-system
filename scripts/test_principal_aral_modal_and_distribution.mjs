import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanGradeNumber,
  cleanSectionName,
  formatGradeSection,
} from "../lib/monitoring/philIriEvaluation.js";
import { getSimplifiedAralStatus } from "../lib/monitoring/aralAcademicStatus.js";
import { getLearnerTimelineSummary } from "../lib/monitoring/aralProgression.js";

test("T1. cleanGradeNumber, cleanSectionName, and formatGradeSection prevent 'Grade Grade 7' and duplicates", () => {
  // cleanGradeNumber
  assert.equal(cleanGradeNumber("Grade Grade 7"), "7");
  assert.equal(cleanGradeNumber("Grade 7"), "7");
  assert.equal(cleanGradeNumber(7), "7");
  assert.equal(cleanGradeNumber("Grade   8"), "8");

  // cleanSectionName
  assert.equal(cleanSectionName("Grade 7 - Rizal"), "Rizal");
  assert.equal(cleanSectionName("Grade 7 – Diamond"), "Diamond");
  assert.equal(cleanSectionName("Diamond"), "Diamond");
  assert.equal(cleanSectionName("Grade Grade 7: Emerald"), "Emerald");

  // formatGradeSection
  assert.equal(formatGradeSection("Grade Grade 7", "Rizal"), "Grade 7 – Rizal");
  assert.equal(formatGradeSection("Grade 7", "Grade 7 - Rizal"), "Grade 7 – Rizal");
  assert.equal(formatGradeSection(7, "Diamond"), "Grade 7 – Diamond");
  assert.equal(formatGradeSection(null, "Grade 8 - Pearl"), "Grade 8 – Pearl");
  assert.equal(formatGradeSection("7", "Rizal"), "Grade 7 – Rizal");
  assert.equal(formatGradeSection(null, null), "Grade — – —");
});

test("T2. getSimplifiedAralStatus maps all learner statuses accurately", () => {
  // 1. Pending (un-assessed)
  const pendingLearner = { currentStepKey: "waiting_for_assessment" };
  const sPending = getSimplifiedAralStatus(pendingLearner);
  assert.equal(sPending.label, "Pending");

  // 2. Screening Complete (At Grade Level)
  const atGradeLearner = { currentStepKey: "screening_complete_at_grade" };
  const sAtGrade = getSimplifiedAralStatus(atGradeLearner);
  assert.equal(sAtGrade.label, "Screening Complete");

  // 3. Needs Assessment (GST < 28)
  const needsAssessment = { currentStepKey: "needs_individual_assessment" };
  const sNeeds = getSimplifiedAralStatus(needsAssessment);
  assert.equal(sNeeds.label, "Needs Assessment");

  // 4. Completed (Form 3 IRA completed)
  const completedLearner = { currentStepKey: "assessment_complete" };
  const sCompleted = getSimplifiedAralStatus(completedLearner);
  assert.equal(sCompleted.label, "Completed");

  // 5. Follow-Up Required (Absent)
  const absentLearner = { isAbsent: true, currentStepKey: "absent_reschedule" };
  const sAbsent = getSimplifiedAralStatus(absentLearner);
  assert.equal(sAbsent.label, "Follow-Up Required");
  assert.equal(sAbsent.detail, "Absent — Reschedule Needed");

  // 6. Follow-Up Required (Under Review with note)
  const reviewNoteLearner = {
    candidateStatus: "For Review",
    teacherReviewReason: "Needs phonemic support",
    currentStepKey: "gst_under_review",
  };
  const sReviewNote = getSimplifiedAralStatus(reviewNoteLearner);
  assert.equal(sReviewNote.label, "Follow-Up Required");
  assert.equal(sReviewNote.detail, "Teacher Review Note");

  // 7. ARAL Eligible — For Review (EOSY persistent need)
  const eosyReviewLearner = { currentStepKey: "for_review" };
  const sEosy = getSimplifiedAralStatus(eosyReviewLearner);
  assert.equal(sEosy.label, "ARAL Eligible — For Review");
});

test("T3. Safe extraction for missing, null, or incomplete learner records prevents crashes", () => {
  // Empty object
  const sEmpty = getSimplifiedAralStatus({});
  assert.equal(sEmpty.label, "Pending");

  // Null learner
  const sNull = getSimplifiedAralStatus(null);
  assert.equal(sNull.label, "Pending");

  // getLearnerTimelineSummary with empty records
  const timelineEmpty = getLearnerTimelineSummary({});
  assert.ok(timelineEmpty.term1);
  assert.ok(timelineEmpty.term2);
  assert.ok(timelineEmpty.term3);
  assert.equal(timelineEmpty.term1.status, "Not Recorded");
});

test("T4. Reading profile distribution separates GST At Grade Level and Form 3 profiles with consistent denominator", () => {
  const learners = [
    // 2 learners at grade level via GST
    { id: 1, currentStepKey: "screening_complete_at_grade", philIriScore: 32 },
    { id: 2, currentStepKey: "screening_complete_at_grade", philIriScore: 30 },
    // 1 Form 3 Independent
    { id: 3, currentStepKey: "assessment_complete", readingLevel: "Independent", philIriScore: 22 },
    // 1 Form 3 Instructional
    { id: 4, currentStepKey: "assessment_complete", readingLevel: "Instructional", philIriScore: 18 },
    // 1 Form 3 Frustration in EOSY For Review
    { id: 5, currentStepKey: "for_review", readingLevel: "Frustration", philIriScore: 14 },
    // 1 un-assessed pending
    { id: 6, currentStepKey: "waiting_for_assessment" },
    // 1 absent
    { id: 7, currentStepKey: "absent_reschedule", isAbsent: true },
  ];

  let atGrade = 0;
  let independent = 0;
  let instructional = 0;
  let frustration = 0;

  for (const l of learners) {
    const isGstAtGrade =
      l.currentStepKey === "screening_complete_at_grade" ||
      l.readingLevel === "At Grade Level" ||
      (!l.readingLevel && Number(l.philIriScore) >= 28 && !l.isAbsent);

    if (isGstAtGrade) {
      atGrade++;
    } else if (l.readingLevel === "Independent") {
      independent++;
    } else if (l.readingLevel === "Instructional") {
      instructional++;
    } else if (l.readingLevel === "Frustration") {
      frustration++;
    }
  }

  const evaluatedTotal = atGrade + independent + instructional + frustration;
  assert.equal(atGrade, 2, "GST At Grade Level strictly 2");
  assert.equal(independent, 1, "Form 3 Independent strictly 1");
  assert.equal(instructional, 1, "Form 3 Instructional strictly 1");
  assert.equal(frustration, 1, "Form 3 Frustration strictly 1");
  assert.equal(evaluatedTotal, 5, "Total evaluated is 5 (excludes un-assessed and absent)");

  const atGradePct = Math.round((atGrade / evaluatedTotal) * 100);
  const indepPct = Math.round((independent / evaluatedTotal) * 100);
  const instPct = Math.round((instructional / evaluatedTotal) * 100);
  const frustPct = Math.round((frustration / evaluatedTotal) * 100);

  assert.equal(atGradePct, 40);
  assert.equal(indepPct, 20);
  assert.equal(instPct, 20);
  assert.equal(frustPct, 20);
  assert.equal(atGradePct + indepPct + instPct + frustPct, 100, "Percentages sum strictly to 100%");
});

test("T5. Section summary breakdown groups by Grade & Section without 'Grade Grade 7'", () => {
  const learners = [
    { grade: "Grade 7", section: "Grade 7 - Rizal", language: "English", currentStepKey: "screening_complete_at_grade", philIriScore: 30 },
    { grade: "Grade Grade 7", section: "Rizal", language: "English", currentStepKey: "assessment_complete", readingLevel: "Instructional" },
    { grade: 7, section: "Diamond", language: "English", currentStepKey: "for_review", readingLevel: "Frustration" },
  ];

  const map = new Map();
  for (const l of learners) {
    const cleanG = cleanGradeNumber(l.grade) || "7";
    const g = `Grade ${cleanG}`;
    const sec = cleanSectionName(l.section) || "General";
    const lang = l.language || l.subject || "English";
    const key = `${g}_${sec}_${lang}`;

    if (!map.has(key)) {
      map.set(key, { grade: g, section: sec, language: lang, total: 0 });
    }
    map.get(key).total++;
  }

  const sections = Array.from(map.values());
  assert.equal(sections.length, 2);
  const rizal = sections.find((s) => s.section === "Rizal");
  assert.ok(rizal);
  assert.equal(rizal.grade, "Grade 7");
  assert.equal(rizal.total, 2);

  const diamond = sections.find((s) => s.section === "Diamond");
  assert.ok(diamond);
  assert.equal(diamond.grade, "Grade 7");
  assert.equal(diamond.total, 1);
});
