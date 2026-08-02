import { ListFilter } from "lucide-react";

export default function TablePagination({ count }) {
  return (
    <div className="flex items-center justify-end gap-1 px-4 pb-3 text-[10px] text-slate-400">
      <ListFilter size={12} aria-hidden="true" />
      {count} records
    </div>
  );
}
