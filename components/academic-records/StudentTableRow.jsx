import { flexRender } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

export default function StudentTableRow({ row, dense = false }) {
  return (
    <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/60">
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className={cn(
            "align-middle text-slate-600",
            dense
              ? "px-2 py-1 text-[11px]"
              : "px-2.5 py-2 text-[11px]"
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}
