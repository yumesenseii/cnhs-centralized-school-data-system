/**
 * Print / PDF — ARAL Summary Cover + Detailed Report.
 * Saved scores and weekly rows only.
 */

import { ARAL_WEEK_OPTIONS } from "@/lib/monitoring/aralProgress";
import {
  formatAralAvgPercent,
  formatAralScore,
  formatAralTrendLine,
} from "@/lib/monitoring/aralSectionReport";
import {
  escapeHtml,
  renderBarChartHtml,
  renderDataTableHtml,
  renderDualSignatureHtml,
  renderKpiRowHtml,
  wrapCnhsPrintDocument,
} from "@/lib/reports/cnhsPrintShell";
import { openPrintableHtml } from "@/lib/reports/openPrintableHtml";

function phaseBarRows(phases = []) {
  const rows = [];
  for (const phase of phases) {
    if (!phase.scored) {
      rows.push({
        name: phase.label,
        value: null,
        display: "Not started",
        fill: "#e2e8f0",
      });
      continue;
    }
    rows.push({
      name: `${phase.label} Passed`,
      value: phase.passed,
      fill: "#246f54",
    });
    rows.push({
      name: `${phase.label} For ARAL`,
      value: phase.forAral,
      fill: "#c2410c",
    });
  }
  return rows;
}

function bandBarRows(bands = []) {
  return (bands ?? [])
    .filter((band) => band.count > 0)
    .map((band) => ({
      name: band.label,
      value: band.count,
      fill: "#246f54",
    }));
}

function coverBodyHtml({
  phases,
  weeklySummary,
  trends,
}) {
  const phaseKpis = (phases ?? []).map((phase) => [
    phase.label,
    phase.scored
      ? `${phase.status} · ${phase.scored}/${phase.total} · ${formatAralAvgPercent(phase.avgPercent)}`
      : phase.status,
  ]);

  const phaseCards = (phases ?? [])
    .map((phase) => {
      const body = phase.scored
        ? `Scored ${phase.scored}/${phase.total} · Passed ${phase.passed} · For ARAL ${phase.forAral} · Avg ${formatAralAvgPercent(phase.avgPercent)} (${phase.scored} scored)`
        : "No saved scores yet";
      return `<div class="kpi"><span>${escapeHtml(phase.label)} · ${escapeHtml(phase.status)}</span><strong style="font-size:13px">${escapeHtml(body)}</strong></div>`;
    })
    .join("");

  const weeklyLine = weeklySummary.hasWeekly
    ? `Latest Week ${weeklySummary.maxWeek} · ${weeklySummary.filled} of ${weeklySummary.total} learners with a weekly row`
    : `No weekly entries saved · ${weeklySummary.total} learners`;

  const trendLine = formatAralTrendLine(trends);

  const phaseChart = renderBarChartHtml(
    "Pre / Mid / Post — Passed vs For ARAL",
    phaseBarRows(phases),
    { showEmpty: true }
  );
  const bandChart = renderBarChartHtml(
    "Weekly progress bands (latest week per learner)",
    bandBarRows(weeklySummary.bands),
    { showEmpty: true }
  );

  return `
    ${renderKpiRowHtml(phaseKpis)}
    <div class="kpi-row cols-3" style="margin-top:8px">${phaseCards}</div>
    <p class="section-label">Weekly</p>
    <p class="note" style="margin-top:0">${escapeHtml(weeklyLine)}</p>
    <p class="section-label">Trend</p>
    <p class="note" style="margin-top:0">${escapeHtml(trendLine || "No assessment results yet")}. Incomplete ≠ failed. Missing Mid/Post = not started, not zero.</p>
    <div class="charts">${phaseChart}${bandChart}</div>
  `;
}

function detailedBodyHtml({ individuals, weeklyRows, weeklySummary }) {
  const assessmentRows = (individuals ?? [])
    .map((row) => {
      const cells = [
        escapeHtml(row.studentName),
        escapeHtml(row.studentNumber || "—"),
        escapeHtml(formatAralScore(row.preScore, row.preMax)),
        escapeHtml(row.preResult || "—"),
        escapeHtml(formatAralScore(row.midScore, row.midMax)),
        escapeHtml(row.midResult || "—"),
        escapeHtml(formatAralScore(row.postScore, row.postMax)),
        escapeHtml(row.postResult || "—"),
        escapeHtml(row.trend || "—"),
      ];
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("");

  const weeklyTableRows = (weeklyRows ?? [])
    .map((row) => {
      const weekCells = ARAL_WEEK_OPTIONS.map((week) => {
        const cell = row.weeks?.[week];
        return `<td>${escapeHtml(cell?.label || "—")}</td>`;
      });
      return `<tr><td>${escapeHtml(row.studentName)}</td><td>${escapeHtml(row.studentNumber)}</td>${weekCells.join("")}<td>${escapeHtml(row.remarks || "—")}</td></tr>`;
    })
    .join("");

  return `
    <p class="section-label">A. Assessment</p>
    ${renderDataTableHtml({
      headers: [
        "Learner",
        "LRN",
        "Pre",
        "Pre result",
        "Mid",
        "Mid result",
        "Post",
        "Post result",
        "Trend",
      ],
      rowsHtml: assessmentRows,
      compact: true,
      emptyText: "No assigned ARAL learners.",
    })}
    <p class="section-label">B. Weekly</p>
    <p class="note">${
      weeklySummary?.hasWeekly
        ? "Blank week = not saved. Not marked Absent."
        : "No weekly sessions saved yet. Leave a week blank if there was no session."
    }</p>
    ${renderDataTableHtml({
      headers: [
        "Learner",
        "LRN",
        "Week 1",
        "Week 2",
        "Week 3",
        "Week 4",
        "Week 5",
        "Week 6",
        "Remarks",
      ],
      rowsHtml: weeklyTableRows,
      compact: true,
      emptyText: "No assigned ARAL learners.",
    })}
  `;
}

export function printAralSectionReport({
  gradeSection = "Section",
  schoolYear = "",
  subject = "",
  programName = "ARAL Program",
  facilitatorName = "Facilitator",
  generatedAt = "",
  learnerCount = 0,
  phases = [],
  weeklySummary = {},
  trends = [],
  individuals = [],
  weeklyRows = [],
} = {}) {
  const metaRows = [
    ["Program", programName],
    ["School year", schoolYear || "—"],
    ["Grade / section", gradeSection],
    ["Subject", subject || "—"],
    ["Facilitator", facilitatorName],
    ["Assigned learners", String(learnerCount)],
    ["Generated", generatedAt || "—"],
  ];

  const coverHtml = coverBodyHtml({ phases, weeklySummary, trends });
  const detailHtml = detailedBodyHtml({
    individuals,
    weeklyRows,
    weeklySummary,
  });

  const html = wrapCnhsPrintDocument({
    documentTitle: `ARAL Report — ${gradeSection}`,
    letterheadSub: `CNHS Learn · ${programName}`,
    title: "ARAL Program Report",
    subtitle: "Summary Cover · Detailed Report",
    metaRows,
    noteHtml: "",
    orientation: "landscape",
    showSignature: false,
    signatureHtml: "",
    bodyHtml: `
      <p class="section-label">1. Summary Cover</p>
      ${coverHtml}
      ${renderDualSignatureHtml({
        preparedBy: facilitatorName,
        preparedRole: "ARAL Facilitator",
        notedBy: "",
        notedRole: "Head Teacher",
      })}
      <div style="page-break-before: always"></div>
      <p class="section-label">2. Detailed Report</p>
      <p class="note">Same assigned roster. Tables only. Saved scores and weekly rows.</p>
      ${detailHtml}
    `,
  });

  openPrintableHtml(html, {
    title: `ARAL-Report-${gradeSection}`,
    autoPrint: true,
  });

  return { filename: `ARAL-Report-${gradeSection}` };
}
