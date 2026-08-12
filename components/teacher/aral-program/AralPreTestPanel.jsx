"use client";

import AralAssessmentPanel from "@/components/teacher/aral-program/AralAssessmentPanel";
import { ARAL_ASSESSMENT_PHASE } from "@/lib/monitoring/aralAssessments";

/** @deprecated Prefer AralAssessmentPanel with phase="pre". Kept for import compatibility. */
export default function AralPreTestPanel(props) {
  return (
    <AralAssessmentPanel {...props} phase={ARAL_ASSESSMENT_PHASE.PRE} />
  );
}
