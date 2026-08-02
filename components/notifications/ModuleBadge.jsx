import {
  BookOpen,
  CalendarRange,
  ClipboardList,
  FileText,
  GraduationCap,
  Settings2,
  Upload,
  Users,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  Upload: Upload,
  "Academic Records": BookOpen,
  "Lesson Plan": FileText,
  Reports: BarChart3,
  Users: Users,
  Monitoring: ClipboardList,
  "ARAL Learners": GraduationCap,
  "ARAL Screening": GraduationCap,
  "Classroom Remedial": BookOpen,
  "Class Assignment": CalendarRange,
  "E-Class Record": Upload,
  System: Settings2,
};

const tones = {
  green: "bg-green-50 text-cnhs-green-dark",
  teal: "bg-teal-50 text-teal-700",
  violet: "bg-violet-50 text-violet-700",
  blue: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
  orange: "bg-orange-50 text-cnhs-orange",
};

export default function ModuleBadge({ label, tone = "green" }) {
  const Icon = icons[label] ?? FileText;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
        tones[tone] ?? tones.green
      )}
    >
      <Icon size={11} strokeWidth={2} />
      {label}
    </span>
  );
}
