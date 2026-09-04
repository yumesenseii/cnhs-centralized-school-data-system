"use client";

import { Upload } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { scoreKey } from "@/lib/ecr/constants";
import EcrHpsRow, {
  EcrHeaderGroups,
  EcrSubHeaders,
} from "@/components/teacher/e-record/EcrHpsRow";
import {
  ECR_NAME_COLS,
  STICKY_COL,
  getEcrGridColumnCount,
  getLearnerRowStatus,
  partitionStudentsBySex,
} from "@/lib/ecr/gridLayout";

const tdBase =
  "border border-slate-200 px-2 py-1 text-[12px] leading-snug text-slate-800 whitespace-nowrap box-border";

const stickyEdgeShadow = "shadow-[4px_0_10px_-2px_rgba(15,23,42,0.14)]";

const stickyNumW = "w-[40px] min-w-[40px] max-w-[40px]";
const stickyLrnW = "w-[112px] min-w-[112px] max-w-[112px]";
const stickyNameW = "w-[180px] min-w-[180px] max-w-[180px]";
const stickyFrozenW = "w-[332px] min-w-[332px] max-w-[332px]";

const stickyCorner = `sticky top-0 left-0 z-[30] border border-slate-200 bg-[#f3f3f3] px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600 box-border ${stickyFrozenW} ${stickyEdgeShadow}`;
const stickyHeadNum = `sticky top-0 left-0 z-[30] border border-slate-200 bg-[#f3f3f3] px-2 py-1.5 text-[10px] font-semibold text-slate-600 box-border ${stickyNumW}`;
const stickyHeadLrn = `sticky top-0 left-[40px] z-[30] border border-slate-200 bg-[#f3f3f3] px-2 py-1.5 text-[10px] font-semibold tabular-nums text-slate-600 box-border ${stickyLrnW}`;
const stickyHeadName = `sticky top-0 left-[152px] z-[30] border border-slate-200 bg-[#f3f3f3] px-2 py-1.5 text-[10px] font-semibold text-slate-600 box-border ${stickyNameW} ${stickyEdgeShadow}`;

const stickySectionLabel = `sticky left-0 z-20 border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 box-border ${stickyFrozenW} ${stickyEdgeShadow}`;

function rowBg(index, zebra = true) {
  if (!zebra) return "bg-white";
  return index % 2 === 0 ? "bg-white" : "bg-slate-50";
}

function stickyBodyCell(bg, { isName = false } = {}) {
  const hover = bg === "bg-white" ? "group-hover:bg-slate-50" : "group-hover:bg-slate-100";
  const shadow = isName ? stickyEdgeShadow : "";
  return `sticky z-20 border border-slate-200 box-border ${bg} ${hover} ${shadow}`;
}

function isScoreInvalid(value, hps) {
  if (value === "" || value === null || value === undefined) return false;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return true;
  return num > Number(hps);
}

function RowStatusBadge({ status }) {
  const styles = {
    empty: "bg-slate-100 text-slate-500",
    partial: "bg-amber-50 text-amber-700",
    complete: "bg-emerald-50 text-emerald-700",
    imported: "bg-sky-50 text-sky-700",
  };
  const labels = {
    empty: "Empty",
    partial: "Partial",
    complete: "Done",
    imported: "Imported",
  };
  return (
    <span
      className={`ml-1.5 inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${styles[status] ?? styles.empty}`}
    >
      {labels[status] ?? labels.empty}
    </span>
  );
}

function ScoreCells({
  config,
  scores,
  computed,
  onScoreChange,
  studentId,
  inputRefs,
  onNavigate,
  onPasteColumn,
}) {
  const groups = ["WW", "PT", "QA"];

  return (
    <>
      {groups.map((component) => {
        const rows = config.filter((r) => r.component === component);
        const prefix = component.toLowerCase();
        return (
          <FragmentGroupCells
            key={component}
            rows={rows}
            scores={scores}
            studentId={studentId}
            onScoreChange={onScoreChange}
            total={computed?.[`${prefix}_total`]}
            ps={computed?.[`${prefix}_ps`]}
            ws={computed?.[`${prefix}_ws`]}
            inputRefs={inputRefs}
            onNavigate={onNavigate}
            onPasteColumn={onPasteColumn}
          />
        );
      })}
      <td className={`${tdBase} relative z-0 bg-slate-50 text-center font-medium`}>
        {computed?.initial_grade ?? "—"}
      </td>
      <td
        className={`${tdBase} relative z-0 bg-[#f0faf4] text-center font-semibold text-cnhs-green-dark`}
      >
        {computed?.term_grade ?? "—"}
      </td>
      <td className={`${tdBase} relative z-0 text-center`}>
        {computed?.description || "—"}
      </td>
    </>
  );
}

function FragmentGroupCells({
  rows,
  scores,
  studentId,
  onScoreChange,
  total,
  ps,
  ws,
  inputRefs,
  onNavigate,
  onPasteColumn,
}) {
  return (
    <>
      {rows.map((row) => {
        const key = scoreKey(row.component, row.item_index);
        const value = scores[key] ?? "";
        const invalid = isScoreInvalid(value, row.highest_possible_score);
        const refKey = `${studentId}:${key}`;

        return (
          <td key={row.id} className={`${tdBase} relative z-0`}>
            <input
              ref={(el) => {
                if (el) inputRefs.current[refKey] = el;
                else delete inputRefs.current[refKey];
              }}
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => onScoreChange(studentId, key, e.target.value)}
              onKeyDown={(e) => onNavigate(e, studentId, key)}
              onPaste={(e) => onPasteColumn(e, studentId, key)}
              className={`h-8 w-[52px] rounded border px-1 text-center text-[12px] transition focus:outline-none focus:ring-2 ${
                invalid
                  ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200"
                  : "border-slate-200 bg-white focus:border-cnhs-green focus:ring-cnhs-green/25"
              }`}
              aria-invalid={invalid}
              title={invalid ? "Score exceeds HPS" : undefined}
            />
          </td>
        );
      })}
      <td className={`${tdBase} relative z-0 bg-slate-50 text-center text-[11px] font-medium`}>
        {total ?? "—"}
      </td>
      <td className={`${tdBase} relative z-0 bg-slate-50 text-center text-[11px]`}>
        {ps ?? "—"}
      </td>
      <td className={`${tdBase} relative z-0 bg-slate-50 text-center text-[11px]`}>
        {ws ?? "—"}
      </td>
    </>
  );
}

export default function EcrGrid({
  students = [],
  config = [],
  studentScores = {},
  computedByStudent = {},
  onScoreChange,
  onConfigUpdate,
  searchQuery = "",
  onImportClick,
}) {
  const inputRefs = useRef({});
  const colSpan = getEcrGridColumnCount(config);
  const scrollColSpan = colSpan - ECR_NAME_COLS;

  const filteredStudents = useMemo(() => {
    const q = String(searchQuery ?? "").trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) => {
      const name = String(student.name ?? "").toLowerCase();
      const lrn = String(student.studentNumber ?? "").toLowerCase();
      return name.includes(q) || lrn.includes(q);
    });
  }, [students, searchQuery]);

  const { male, female } = useMemo(
    () => partitionStudentsBySex(filteredStudents),
    [filteredStudents]
  );

  const orderedStudentIds = useMemo(() => {
    return [...male, ...female].map((s) => s.id);
  }, [male, female]);

  const orderedFieldKeys = useMemo(() => {
    const keys = [];
    for (const component of ["WW", "PT", "QA"]) {
      const rows = config.filter((r) => r.component === component);
      for (const row of rows) {
        keys.push(scoreKey(row.component, row.item_index));
      }
    }
    return keys;
  }, [config]);

  const handleNavigate = useCallback(
    (e, studentId, fieldKey) => {
      const studentIdx = orderedStudentIds.indexOf(studentId);
      const fieldIdx = orderedFieldKeys.indexOf(fieldKey);
      if (studentIdx < 0 || fieldIdx < 0) return;

      const focusAt = (sIdx, fIdx) => {
        const sid = orderedStudentIds[sIdx];
        const fk = orderedFieldKeys[fIdx];
        if (!sid || !fk) return;
        inputRefs.current[`${sid}:${fk}`]?.focus();
      };

      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        focusAt(studentIdx + 1, fieldIdx);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        focusAt(studentIdx - 1, fieldIdx);
        return;
      }
      if (e.key === "ArrowRight" && e.target.selectionStart === e.target.value.length) {
        e.preventDefault();
        focusAt(studentIdx, fieldIdx + 1);
        return;
      }
      if (e.key === "ArrowLeft" && e.target.selectionStart === 0) {
        e.preventDefault();
        focusAt(studentIdx, fieldIdx - 1);
      }
    },
    [orderedStudentIds, orderedFieldKeys]
  );

  const handlePasteColumn = useCallback(
    (e, studentId, fieldKey) => {
      const text = e.clipboardData?.getData("text") ?? "";
      if (!text.includes("\n") && !text.includes("\t")) return;

      e.preventDefault();
      const startIdx = orderedStudentIds.indexOf(studentId);
      if (startIdx < 0) return;

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.split("\t")[0]?.trim() ?? "")
        .filter((line, index, arr) => line !== "" || index < arr.length - 1);

      lines.forEach((line, offset) => {
        const targetId = orderedStudentIds[startIdx + offset];
        if (!targetId || line === "") return;
        onScoreChange(targetId, fieldKey, line);
      });
    },
    [orderedStudentIds, onScoreChange]
  );

  function renderSection(label, rows) {
    if (!rows.length) return null;
    return (
      <>
        <tr>
          <td colSpan={ECR_NAME_COLS} className={stickySectionLabel}>
            {label}
          </td>
          <td
            colSpan={scrollColSpan}
            className="border border-slate-200 bg-slate-100"
          />
        </tr>
        {rows.map((student, index) => {
          const bg = rowBg(index);
          const computed = computedByStudent[student.id];
          const status = getLearnerRowStatus(
            studentScores[student.id] ?? {},
            config,
            { termGrade: computed?.term_grade }
          );
          const stickyNum = `${stickyBodyCell(bg)} left-0 ${stickyNumW} text-center`;
          const stickyLrn = `${stickyBodyCell(bg)} left-[40px] ${stickyLrnW} text-[11px] tabular-nums text-slate-600`;
          const stickyName = `${stickyBodyCell(bg, { isName: true })} left-[152px] ${stickyNameW}`;

          return (
            <tr key={student.id} className="group">
              <td className={`${tdBase} ${stickyNum}`}>{index + 1}</td>
              <td className={`${tdBase} ${stickyLrn}`}>
                {student.studentNumber ?? "—"}
              </td>
              <td className={`${tdBase} ${stickyName}`}>
                <span className="block truncate font-medium">{student.name}</span>
                <RowStatusBadge status={status} />
              </td>
              <ScoreCells
                config={config}
                scores={studentScores[student.id] ?? {}}
                computed={computedByStudent[student.id]}
                onScoreChange={onScoreChange}
                studentId={student.id}
                inputRefs={inputRefs}
                onNavigate={handleNavigate}
                onPasteColumn={handlePasteColumn}
              />
            </tr>
          );
        })}
      </>
    );
  }

  if (!students.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
        <p className="text-sm font-medium text-slate-700">No learners enrolled</p>
        <p className="mt-1 text-[12px] text-slate-500">
          Import an ECR Excel file to load the class roster, or contact your Head
          Teacher to enroll learners.
        </p>
        {onImportClick ? (
          <button
            type="button"
            onClick={onImportClick}
            className="mt-4 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-violet-600 px-4 text-[12px] font-semibold text-white hover:bg-violet-700"
          >
            <Upload size={14} />
            Import ECR Excel
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="isolate overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-[1280px] w-full border-collapse">
        <colgroup>
          <col style={{ width: STICKY_COL.numW }} />
          <col style={{ width: STICKY_COL.lrnW }} />
          <col style={{ width: STICKY_COL.nameW }} />
        </colgroup>
        <thead>
          <tr>
            <th className={stickyCorner} colSpan={ECR_NAME_COLS}>
              Learners&apos; Names
            </th>
            <EcrHeaderGroups config={config} />
          </tr>
          <tr>
            <th className={stickyHeadNum}>#</th>
            <th className={stickyHeadLrn}>LRN</th>
            <th className={stickyHeadName}>Name</th>
            <EcrSubHeaders config={config} />
          </tr>
          <EcrHpsRow config={config} onUpdate={onConfigUpdate} />
        </thead>
        <tbody>
          {renderSection("Male", male)}
          {renderSection("Female", female)}
          {filteredStudents.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="px-4 py-10 text-center text-sm text-slate-400"
              >
                No learners match your search.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
