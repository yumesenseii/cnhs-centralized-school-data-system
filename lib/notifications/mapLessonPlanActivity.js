/**
 * Map lesson_plan_events rows into Recent Activity timeline items.
 */
export function mapLessonPlanEvents(rows = []) {
  return rows.map((row) => {
    const plan = Array.isArray(row.lesson_plans)
      ? row.lesson_plans[0]
      : row.lesson_plans;
    const teacher = plan?.teachers;
    const teacherName = teacher
      ? [teacher.first_name, teacher.last_name].filter(Boolean).join(" ")
      : null;
    const event = String(row.event_type || "").toLowerCase();
    let icon = "file";
    let tone = "violet";
    let title = plan?.lesson_title
      ? `Lesson plan — ${plan.lesson_title}`
      : "Lesson plan update";

    if (event.includes("approv")) {
      icon = "check";
      tone = "green";
      title = `Approved — ${plan?.lesson_title || "Lesson plan"}`;
    } else if (event.includes("revision") || event.includes("needs")) {
      icon = "revision";
      tone = "orange";
      title = `Needs revision — ${plan?.lesson_title || "Lesson plan"}`;
    } else if (event.includes("submit")) {
      icon = "file";
      tone = "violet";
      title = `Submitted — ${plan?.lesson_title || "Lesson plan"}`;
    }

    const when = row.created_at ? new Date(row.created_at) : null;
    const timestamp = when
      ? when.toLocaleString("en-PH", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";

    return {
      id: row.id,
      title,
      description: [row.actor_name || teacherName, row.remarks]
        .filter(Boolean)
        .join(" · "),
      timestamp,
      icon,
      tone,
    };
  });
}
