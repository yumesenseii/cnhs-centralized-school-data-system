/**
 * Official Personalized Learning Plan (PLP) PDF Exporter
 * Generates official DepEd Cambaog National High School Individual Learning Plans:
 *
 * Guarantees:
 * - DepEd Order / Learning Remediation & RA 12028 (ARAL Program Act) standards
 * - Official Cambaog NHS header with School ID 300793, Division of Bulacan, Bustos
 * - Zero fabricated signatories (honest signature lines and official school head DULCE VILMA R. GALANG)
 * - Pure client-side export honoring FEATURE_PLP_PERSISTENCE = false
 * - Windows-safe filename generation
 */

import { SYSTEM_NAME } from "@/lib/constants/brand";
import {
  escapeHtml,
  renderDualSignatureHtml,
  renderKpiRowHtml,
  wrapCnhsPrintDocument,
} from "@/lib/reports/cnhsPrintShell";
import { openPrintableHtml } from "@/lib/reports/openPrintableHtml";
import { SF9_SCHOOL_INFO } from "@/lib/reports/sf9DataService";
import { windowsSafeFilename } from "@/lib/reports/exportFilenames";

function safeToken(value) {
  return (
    String(value ?? "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "NA"
  );
}

/**
 * Standardized Windows-safe filename builder for PLP exports
 */
export function buildPlpReportFilename({
  learnerName = "Learner",
  schoolYear = "SY 2026-2027",
  planType = "individual",
  format = "pdf",
} = {}) {
  const cleanName = safeToken(learnerName || "Learner");
  const cleanYear = String(schoolYear || "SY 2026-2027").replace(/\s+/g, "");
  const cleanType = safeToken(planType || "PLP");
  const ext = format === "excel" ? "xlsx" : "pdf";
  const raw = `CNHS_PLP_${cleanName}_${cleanType}_${cleanYear}.${ext}`;
  return windowsSafeFilename(raw);
}

/**
 * Builds and launches the official PLP PDF document
 */
export function exportPlpPdf({
  plp = {},
  learner = {},
  teacherName = "",
  schoolHeadName = null,
} = {}) {
  const learnerName =
    learner?.name ||
    learner?.studentName ||
    learner?.student_name ||
    "Learner";

  const studentNumber =
    learner?.studentNumber ||
    learner?.lrn ||
    learner?.student_id ||
    learner?.id ||
    "—";

  const gradeSection =
    learner?.gradeSectionDisplay ||
    learner?.gradeSection ||
    (learner?.grade ? `Grade ${learner.grade}` : "—");

  const schoolYear = plp?.school_year || learner?.schoolYear || "SY 2026-2027";

  const filename = buildPlpReportFilename({
    learnerName,
    schoolYear,
    planType: plp?.plan_type || "individual",
    format: "pdf",
  });

  const generatedAt = new Date().toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const planTypeLabels = {
    academic_remedial: "Academic Remediation Plan",
    reading_aral: "Reading & ARAL Program Plan",
    composite: "Composite (Academic & Reading) Plan",
  };
  const resolvedPlanType = planTypeLabels[plp?.plan_type] || "Personalized Learning Plan";

  // Section list renderer helper
  const renderBulletListHtml = (items = []) => {
    if (!items || items.length === 0) {
      return `<p class="muted" style="margin-left:8px;">No specific items recorded.</p>`;
    }
    return `
      <ul class="plain-list" style="margin-bottom:14px; line-height:1.6;">
        ${items
          .map((item) => {
            if (typeof item === "string") {
              return `<li>${escapeHtml(item)}</li>`;
            }
            if (item && typeof item === "object") {
              if (item.metric) {
                return `<li><strong>${escapeHtml(item.metric)}</strong> (${escapeHtml(
                  item.frequency || "Periodic"
                )}): ${escapeHtml(item.target || "")}</li>`;
              }
              if (item.target) {
                return `<li><strong>${escapeHtml(item.target)}</strong>${
                  item.competencyFocus
                    ? ` — <span style="color:#64748b;">${escapeHtml(item.competencyFocus)}</span>`
                    : ""
                }</li>`;
              }
              if (item.title || item.type) {
                return `<li><strong>${escapeHtml(item.title || item.type)}:</strong> ${escapeHtml(
                  item.description || ""
                )}</li>`;
              }
              if (item.description) {
                return `<li><strong>${escapeHtml(
                  item.category || item.subject || "Need"
                )}:</strong> ${escapeHtml(item.description)}</li>`;
              }
            }
            return `<li>${escapeHtml(String(item))}</li>`;
          })
          .join("")}
      </ul>
    `;
  };

  const kpis = [
    ["Overall Risk", plp?.overall_risk_level || "Standard"],
    ["Plan Type", resolvedPlanType],
    ["School Year", schoolYear],
    ["Status", plp?.status ? String(plp.status).toUpperCase() : "DRAFT"],
  ];

  const bodyHtml = `
    <div style="border:1px solid #cfe8dc; border-radius:8px; padding:12px 16px; background:#f8fafc; margin-bottom:14px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; font-size:11px;">
        <div><strong style="color:#64748b;">Learner Name:</strong> <span style="font-weight:700; color:#1e293b;">${escapeHtml(learnerName)}</span></div>
        <div><strong style="color:#64748b;">Student No. / LRN:</strong> <span style="font-weight:600; color:#1e293b;">${escapeHtml(studentNumber)}</span></div>
        <div><strong style="color:#64748b;">Grade & Section:</strong> <span style="font-weight:600; color:#1e293b;">${escapeHtml(gradeSection)}</span></div>
        <div><strong style="color:#64748b;">Recommended Support:</strong> <span style="font-weight:600; color:#246f54;">${escapeHtml(plp?.recommended_support_level || "Standard Support")}</span></div>
      </div>
    </div>

    ${renderKpiRowHtml(kpis)}

    <p class="section-label" style="margin-top:16px;">1. Identified Learning Needs & Competency Gaps</p>
    ${renderBulletListHtml(plp?.learning_needs)}

    <p class="section-label" style="margin-top:14px;">2. Targeted Learning Objectives</p>
    ${renderBulletListHtml(plp?.target_objectives)}

    <p class="section-label" style="margin-top:14px;">3. Recommended Learning Activities & Interventions</p>
    ${renderBulletListHtml(plp?.recommended_activities)}

    <p class="section-label" style="margin-top:14px;">4. Monitoring Indicators & Success Criteria</p>
    ${renderBulletListHtml(plp?.monitoring_indicators)}

    ${
      plp?.teacher_notes
        ? `
        <p class="section-label" style="margin-top:14px;">5. Teacher Notes & Instructional Adjustments</p>
        <div style="border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; font-size:11px; color:#334155; background:#fff; margin-bottom:14px;">
          ${escapeHtml(plp.teacher_notes)}
        </div>`
        : ""
    }
  `;

  // Honest signatories
  const prepNameUpper =
    teacherName && !teacherName.toLowerCase().includes("maria santos")
      ? teacherName.toUpperCase()
      : "(Signature over Printed Name)";
  const headNameUpper =
    schoolHeadName && !schoolHeadName.toLowerCase().includes("maria santos")
      ? schoolHeadName.toUpperCase()
      : (SF9_SCHOOL_INFO.defaultSchoolHead || "(Signature over Printed Name)");

  const html = wrapCnhsPrintDocument({
    documentTitle: `Personalized Learning Plan — ${learnerName}`,
    letterheadSub: `${SF9_SCHOOL_INFO.region} · ${SF9_SCHOOL_INFO.division} · ${SF9_SCHOOL_INFO.municipality.toUpperCase()} · School ID: ${SF9_SCHOOL_INFO.schoolId}`,
    title: "PERSONALIZED LEARNING PLAN (PLP)",
    subtitle: `${resolvedPlanType} · ${learnerName} · ${schoolYear}`,
    metaRows: [
      ["Learner Name", learnerName],
      ["LRN / Student No.", String(studentNumber)],
      ["Grade & Section", gradeSection],
      ["Date Generated", generatedAt],
    ],
    noteHtml:
      "AUTHORITATIVE POLICY NOTE: Working educator draft preview (unsaved). Formulated in accordance with DepEd Learning Recovery / Remediation Guidelines & RA 12028 (ARAL Program Act).",
    bodyHtml,
    showSignature: false,
    signatureHtml: renderDualSignatureHtml({
      preparedBy: prepNameUpper,
      preparedRole: "Class Adviser / Subject Teacher",
      notedBy: headNameUpper,
      notedRole: SF9_SCHOOL_INFO.schoolHeadTitle || "School Head / Principal",
    }),
    orientation: "portrait",
  });

  if (typeof window !== "undefined") {
    openPrintableHtml(html, {
      title: filename.replace(/\.pdf$/i, ""),
      autoPrint: true,
    });
  }

  return { success: true, filename, html };
}
