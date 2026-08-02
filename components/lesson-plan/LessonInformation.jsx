export default function LessonInformation({ lesson }) {
  const details = [
    ["Lesson Title", lesson.lessonTitle],
    ["Learning Area", lesson.learningArea],
    ["Curriculum Code", lesson.curriculumCode],
    ["Grade & Section", lesson.gradeSection],
    ["Teacher", lesson.teacher],
    ["Week Covered", lesson.weekCovered],
    ["Submission Date", lesson.submissionDate],
  ];

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Lesson Information</h3>
      <div className="rounded-2xl bg-slate-50 p-5">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {details.map(([label, value], index) => (
            <div key={label} className={index === 0 ? "sm:col-span-2" : undefined}>
              <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm font-semibold leading-5 text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
