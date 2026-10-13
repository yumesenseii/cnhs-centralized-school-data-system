import { flexRender } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

export default function StudentTableRow({ row }) {
  return (
    <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/60">
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className="px-4 py-3 align-middle text-[13px] text-slate-600"
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}
