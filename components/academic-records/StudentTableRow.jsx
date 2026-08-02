import { flexRender } from "@tanstack/react-table";

export default function StudentTableRow({ row }) {
  return (
    <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/60">
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-4 py-4 align-middle text-xs text-slate-600">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}
