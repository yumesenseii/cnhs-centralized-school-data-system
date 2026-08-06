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
import StatusBadge from "@/components/dashboard/StatusBadge";

const columns = [
  "Student Number",
  "Student Name",
  "Grade / Section",
  "General Average",
  "Weak Subject",
  "Risk Level",
  "Suggested Intervention",
  "Status",
  "Action",
];

export default function PriorityLearnersTable({ learners }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-semibold tracking-[-0.02em] text-slate-800">
          Priority Learners Requiring Review
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Learners automatically identified through academic performance (ECR grades) only.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100 bg-slate-50/70 hover:bg-slate-50/70">
              {columns.map((column) => (
                <TableHead
                  key={column}
                  scope="col"
                  className="h-8 whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
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
                  className="px-5 py-10 text-center text-sm text-slate-500"
                >
                  No priority learners for the current school data.
                </TableCell>
              </TableRow>
            ) : (
              learners.map((learner) => (
              <TableRow
                key={learner.id ?? learner.studentNumber}
                className="border-slate-100 hover:bg-slate-50/60"
              >
                <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-medium text-slate-500">
                  {learner.studentNumber}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-slate-800">
                  {learner.studentName}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-sm text-slate-600">
                  {learner.gradeSection}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-sm font-medium text-slate-700">
                  {learner.generalAverage}
                </TableCell>
                <TableCell className="max-w-[150px] px-3 py-2 text-sm text-slate-600">
                  {learner.weakSubject}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2">
                  <RiskBadge value={learner.riskLevel} />
                </TableCell>
                <TableCell className="min-w-[220px] px-3 py-2 text-sm text-slate-600">
                  {learner.suggestedIntervention}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2">
                  <StatusBadge value={learner.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer rounded-lg border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    View
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
