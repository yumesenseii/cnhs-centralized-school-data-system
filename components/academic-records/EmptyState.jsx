import { FolderOpen } from "lucide-react";

export default function EmptyState({ message = "No academic records to display." }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
      <FolderOpen size={24} className="text-slate-300" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>
      <p className="mt-1 text-xs text-slate-400">
        Uploaded E-Class Records will appear here.
      </p>
    </div>
  );
}
