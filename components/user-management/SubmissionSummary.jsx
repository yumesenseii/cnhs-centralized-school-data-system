import SubmissionProgress from "@/components/user-management/SubmissionProgress";

export default function SubmissionSummary({ summary }) {
  if (!summary) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-800">Submission Summary</h3>

      <div className="mt-4 space-y-5">
        <div>
          <p className="text-[12px] font-semibold text-slate-700">Official E-Class Records</p>
          <div className="mt-3 space-y-3">
            {summary.eClass.map((item) => (
              <SubmissionProgress
                key={item.label}
                label={`${item.label} · ${item.value}`}
                percent={item.percent}
                tone={item.tone}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[12px] font-semibold text-slate-700">Lesson Plans</p>
          <div className="mt-3 space-y-3">
            {summary.lessonPlans.map((item) => (
              <SubmissionProgress
                key={item.label}
                label={`${item.label} · ${item.value}`}
                percent={item.percent}
                tone={item.tone}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
