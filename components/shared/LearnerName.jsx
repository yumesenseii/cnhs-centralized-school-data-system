import { parseLearnerName } from "@/lib/people/learnerName";
import { cn } from "@/lib/utils";

export default function LearnerName({
  firstName,
  middleName,
  lastName,
  name,
  className,
}) {
  const { given, surname } = parseLearnerName({
    firstName,
    middleName,
    lastName,
    name,
  });

  if (!given && !surname) {
    return (
      <span className={cn("text-[12px] leading-4 text-slate-800", className)}>
        —
      </span>
    );
  }

  return (
    <span className={cn("text-[12px] leading-4 text-slate-800", className)}>
      {surname ? <span className="font-bold">{surname}</span> : null}
      {surname && given ? ", " : null}
      {given ? <span className="font-normal">{given}</span> : null}
    </span>
  );
}
