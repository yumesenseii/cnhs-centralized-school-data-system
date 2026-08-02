import { ArrowUpRight } from "lucide-react";

export default function ActionButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-3.5 text-[11px] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54]"
    >
      {label}
      <ArrowUpRight size={13} strokeWidth={2.2} />
    </button>
  );
}
