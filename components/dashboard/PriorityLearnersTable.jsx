import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RiskBadge from "@/components/dashboard/RiskBadge";
import { cn } from "@/lib/utils";

const columns = [
  "Learner",
  "Grade & Section",
  "Subject Needing Attention",
  "Academic Risk Level",
  "Recommended Pathway",
  "Action",
];

function PathwayBadge({ value }) {
  const isAral = String(value || "").toLowerCase().includes("aral");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        isAral
          ? "border border-purple-200 bg-purple-50 text-purple-800"
          : "border border-blue-200 bg-blue-50 text-blue-800"
      )}
    >
      {isAral ? "ARAL Program (RA 12028)" : "Classroom Remediation"}
    </span>
  );
}

export default function PriorityLearnersTable({ learners = [], onViewLearner }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.03)]">
      <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.02em] text-slate-800">
              Priority Learners Requiring Academic Review
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Identified through official ECR grades. Diagnostic assessments and authorized school personnel determine final placement.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {learners.length} Identified Learners
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100 bg-slate-50/60 hover:bg-slate-50/60">
              {columns.map((column) => (
                <TableHead
                  key={column}
                  scope="col"
                  className="h-9 whitespace-nowrap px-4 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500"
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {learners.length === 0 ? (
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="px-5 py-10 text-center text-sm text-slate-400"
                >
                  No priority learners for the current school data.
                </TableCell>
              </TableRow>
            ) : (
              learners.map((learner) => (
                <TableRow
                  key={learner.id ?? learner.studentNumber}
                  className="border-slate-100 transition-colors hover:bg-slate-50/50"
                >
                  <TableCell className="px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {learner.studentName}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        LRN: {learner.studentNumber || "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-slate-600">
                    {learner.gradeSection}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-slate-700">
                    <span className="font-semibold text-slate-800">
                      {learner.weakSubject || "General Academic"}
                    </span>
                    {learner.generalAverage ? (
                      <span className="ml-1.5 text-[11px] text-slate-400">
                        (Avg: {learner.generalAverage})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-2.5">
                    <RiskBadge value={learner.riskLevel} />
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <PathwayBadge value={learner.suggestedIntervention || learner.recommendation} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-2.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onViewLearner?.(learner)}
                      className="h-7 cursor-pointer rounded-lg border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-cnhs-green/40 hover:bg-cnhs-green-soft/30 hover:text-cnhs-green-dark"
                    >
                      View Record
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
