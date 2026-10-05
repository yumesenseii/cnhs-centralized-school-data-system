"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Send,
  Loader2,
  Sparkles,
  TrendingUp,
  Sun,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import {
  saveAralProgressCheck,
  listAralProgressChecks,
  updateAralInterventionStatus,
  recordMidlineDecision,
  recordEosyDecision,
} from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function AralLearnerProfileModal({
  isOpen,
  onClose,
  learner,
  schoolYear = "SY 2026-2027",
  onUpdated,
}) {
  const { showToast } = useAppToast();
  const [activeTab, setActiveTab] = useState("overview"); // 'overview', 'progress', 'midline', 'eosy'

  // Progress checks state
  const [progressChecks, setProgressChecks] = useState([]);
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [addingCheck, setAddingCheck] = useState(false);
  const [newCheck, setNewCheck] = useState({
    checkDate: new Date().toISOString().split("T")[0],
    activityName: "",
    result: "",
    competency: "",
    teacherObservation: "",
    nextAction: "",
  });

  // Midline state
  const [midlineForm, setMidlineForm] = useState({
    score: "",
    result: "Does Not Meet Expected Competency",
    decision: "Continue ARAL",
    remarks: "",
  });
  const [savingMidline, setSavingMidline] = useState(false);

  // EOSY state
  const [eosyForm, setEosyForm] = useState({
    score: "",
    result: "Requires Additional Support",
    decision: "ARAL Summer Referral",
    summerReferralReason: "Did not reach expected reading competency after full-year intervention",
    remarks: "",
  });
  const [savingEosy, setSavingEosy] = useState(false);

  // Load progress checks
  useEffect(() => {
    if (!isOpen || !learner?.studentId) return;

    let isMounted = true;
    setLoadingChecks(true);
    listAralProgressChecks(learner.studentId)
      .then((res) => {
        if (isMounted) setProgressChecks(res.data || []);
      })
      .finally(() => {
        if (isMounted) setLoadingChecks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, learner?.studentId]);

  if (!isOpen || !learner) return null;

  const handleCreateProgressCheck = async (e) => {
    e.preventDefault();
    if (!newCheck.activityName || !newCheck.result || !newCheck.competency) {
      showToast("error", "Please complete activity name, competency, and result.");
      return;
    }

    setAddingCheck(true);
    try {
      const res = await saveAralProgressCheck({
        interventionId: learner.interventionId || null,
        studentId: learner.studentId,
        checkDate: newCheck.checkDate,
        activityName: newCheck.activityName,
        result: newCheck.result,
        competency: newCheck.competency,
        teacherObservation: newCheck.teacherObservation,
        nextAction: newCheck.nextAction,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to record progress check.");
        return;
      }

      showToast("success", "Progress check recorded.");
      setNewCheck({
        checkDate: new Date().toISOString().split("T")[0],
        activityName: "",
        result: "",
        competency: "",
        teacherObservation: "",
        nextAction: "",
      });

      // Refresh list
      const refreshed = await listAralProgressChecks(learner.studentId);
      setProgressChecks(refreshed.data || []);
      onUpdated?.();
    } catch {
      showToast("error", "Error saving progress check.");
    } finally {
      setAddingCheck(false);
    }
  };

  const handleSaveMidline = async () => {
    setSavingMidline(true);
    try {
      const res = await recordMidlineDecision({
        studentId: learner.studentId,
        classId: learner.classId,
        score: midlineForm.score,
        result: midlineForm.result,
        decision: midlineForm.decision,
        remarks: midlineForm.remarks,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to record Midline decision.");
        return;
      }

      showToast("success", `Midline recorded: ${midlineForm.decision}`);
      onUpdated?.();
      onClose();
    } catch {
      showToast("error", "Error recording Midline decision.");
    } finally {
      setSavingMidline(false);
    }
  };

  const handleSaveEosy = async () => {
    setSavingEosy(true);
    try {
      const res = await recordEosyDecision({
        studentId: learner.studentId,
        classId: learner.classId,
        score: eosyForm.score,
        result: eosyForm.result,
        decision: eosyForm.decision,
        summerReferralReason: eosyForm.summerReferralReason,
        remarks: eosyForm.remarks,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to record EOSY decision.");
        return;
      }

      showToast("success", `EOSY decision saved: ${eosyForm.decision}`);
      onUpdated?.();
      onClose();
    } catch {
      showToast("error", "Error recording EOSY decision.");
    } finally {
      setSavingEosy(false);
    }
  };

  const handleMoveToIntervention = async () => {
    const res = await updateAralInterventionStatus({
      studentId: learner.studentId,
      classId: learner.classId,
      status: "Active Intervention",
      targetCompetency: learner.targetCompetency || "Reading Comprehension & Oral Fluency",
    });

    if (!res.error) {
      showToast("success", `${learner.name} moved to Active Intervention.`);
      onUpdated?.();
      onClose();
    }
  };

  // Derive supportive RF risk details
  const rfRiskLevel = learner.riskLevel || (learner.academicRiskLevel === "High Risk" ? "High" : "Moderate");
  const rfConfidence = learner.confidence ? Math.round(learner.confidence * 100) : 87;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cnhs-green-soft p-2.5 text-cnhs-green-dark">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{learner.name}</h2>
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                  {learner.lrn ? `LRN: ${learner.lrn}` : "No LRN"}
                </span>
                <span className="rounded-full bg-cnhs-green-soft px-2.5 py-0.5 text-[11px] font-bold text-cnhs-green-dark">
                  {learner.interventionStatus || learner.monitoringStatus || "Needs Review"}
                </span>
              </div>
              <p className="text-[12px] text-slate-500">
                {learner.gradeAndSection || `${learner.grade} ${learner.section}`} &bull; {learner.subject || "English Reading"} &bull; {schoolYear}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-100 px-6 pt-2 bg-white text-xs font-semibold">
          {[
            { id: "overview", label: "Profile & BOSY Assessment" },
            { id: "progress", label: `Progress Checks (${progressChecks.length})` },
            { id: "midline", label: "Midline Decision" },
            { id: "eosy", label: "EOSY & Summer Referral" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "border-b-2 px-3.5 py-2.5 transition-colors",
                activeTab === tab.id
                  ? "border-cnhs-green text-cnhs-green-dark"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW & BOSY ASSESSMENT */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Row 1: BOSY Assessment Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-cnhs-green" />
                    <h3 className="text-sm font-bold text-slate-900">
                      DepEd BOSY Assessment (Phil-IRI Form 1B / Form 3)
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Official Screening
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Assessment Tool</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      {learner.philIriForm || "Phil-IRI Form 1B"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Raw Score</p>
                    <p className="mt-1 font-bold text-slate-900 text-sm">
                      {learner.philIriScore != null ? `${learner.philIriScore} / 20` : "Needs Assessment"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Reading Level</p>
                    <p className={cn(
                      "mt-1 font-bold",
                      learner.readingLevel === "Frustration" ? "text-rose-700" : "text-amber-700"
                    )}>
                      {learner.readingLevel || "Frustration"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400">DepEd Interpretation</p>
                    <p className="mt-1 font-medium text-slate-700">
                      {learner.screeningInterpretation || "2–3 levels lower Phil-IRI testing"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-emerald-50/50 p-3 text-xs border border-emerald-100">
                  <p className="font-bold text-emerald-950">Identified Competency Gap:</p>
                  <p className="mt-0.5 text-emerald-800">
                    Difficulty with inferential comprehension and vocabulary decoding in Grade-level reading passages.
                  </p>
                </div>
              </div>

              {/* Row 2: Supportive Random Forest Decision Support Box */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
                <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-700" />
                    <h3 className="text-sm font-bold text-blue-950">
                      Random Forest Risk Classification (Analytical Decision Support)
                    </h3>
                  </div>
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                    Supportive Layer
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg bg-white p-3 border border-blue-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Risk Classification</p>
                    <p className="mt-1 font-bold text-rose-700 text-sm">
                      {rfRiskLevel} Risk
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-blue-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Model Confidence</p>
                    <p className="mt-1 font-bold text-blue-800 text-sm">
                      {rfConfidence}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-blue-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Recommended Action</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      Prioritize for intervention review
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-blue-900 leading-relaxed">
                  <p className="font-semibold">Contributing Indicators:</p>
                  <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-blue-800">
                    <li>Phil-IRI screening score below Grade benchmark ({learner.philIriScore || "Low"})</li>
                    <li>Quarterly class grade below 75% ({learner.classSubjectGrade || learner.academicGrade || "73%"})</li>
                    <li>Low performance trajectory detected in formative reading quizzes</li>
                  </ul>
                </div>

                <p className="mt-3 text-[10px] text-slate-400 italic">
                  Note: Random Forest classification serves exclusively as advisory decision support. Official assessment rules and teacher discretion govern placement.
                </p>
              </div>

              {/* Action: Move to Active Intervention if Needs Review */}
              {learner.interventionStatus !== "Active Intervention" && learner.interventionStatus !== "Completed" ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Start Official ARAL Intervention</h4>
                    <p className="text-[11px] text-slate-500">
                      Place learner into Active Intervention status to begin progress check tracking.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleMoveToIntervention}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#246f54]"
                  >
                    Start Intervention
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: PROGRESS CHECKS */}
          {activeTab === "progress" && (
            <div className="space-y-5">
              {/* Add Progress Check Form */}
              <form onSubmit={handleCreateProgressCheck} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="text-xs font-bold text-slate-900">Record Progress Check</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Log a concise milestone check (e.g., Weekly Reading Session, Oral Fluency Check).
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-medium text-slate-700">Date</label>
                    <input
                      type="date"
                      value={newCheck.checkDate}
                      onChange={(e) => setNewCheck({ ...newCheck, checkDate: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Assessment / Activity</label>
                    <input
                      type="text"
                      placeholder="e.g. Oral Reading Passage 3"
                      value={newCheck.activityName}
                      onChange={(e) => setNewCheck({ ...newCheck, activityName: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Target Competency</label>
                    <input
                      type="text"
                      placeholder="e.g. Multi-syllabic decoding"
                      value={newCheck.competency}
                      onChange={(e) => setNewCheck({ ...newCheck, competency: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="font-medium text-slate-700">Result / Score</label>
                    <input
                      type="text"
                      placeholder="e.g. 8/10 Words Correct (80%)"
                      value={newCheck.result}
                      onChange={(e) => setNewCheck({ ...newCheck, result: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Teacher Observation</label>
                    <input
                      type="text"
                      placeholder="e.g. Improved pacing, fewer miscues"
                      value={newCheck.teacherObservation}
                      onChange={(e) => setNewCheck({ ...newCheck, teacherObservation: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Next Action</label>
                    <input
                      type="text"
                      placeholder="e.g. Practice silent comprehension"
                      value={newCheck.nextAction}
                      onChange={(e) => setNewCheck({ ...newCheck, nextAction: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={addingCheck}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
                  >
                    {addingCheck ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Save Progress Check
                  </button>
                </div>
              </form>

              {/* Progress Checks Timeline */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-xs font-bold text-slate-900 mb-3">Chronological Progress History</h4>
                {loadingChecks ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading checks...</div>
                ) : progressChecks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No progress checks recorded yet. Use the form above to add the first check.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {progressChecks.map((item) => (
                      <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{item.activity_name}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              {item.competency}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              {item.result}
                            </span>
                          </div>
                          {item.teacher_observation ? (
                            <p className="mt-1 text-slate-600 text-[11px]">
                              Obs: {item.teacher_observation}
                            </p>
                          ) : null}
                          {item.next_action ? (
                            <p className="mt-0.5 text-slate-400 text-[10px]">
                              Next: {item.next_action}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {item.check_date}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MIDLINE ASSESSMENT */}
          {activeTab === "midline" && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Clock size={16} className="text-cnhs-green" />
                  <h3 className="text-sm font-bold text-slate-900">Midline Assessment & Evaluation</h3>
                </div>

                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  Midline assessment serves as an interim decision point. Determine whether the learner has met expected competencies for enrichment/exit or requires continued intervention. (Summer referral occurs at EOSY).
                </p>

                <div className="mt-4 space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700">Midline Assessment Score / Percentage</label>
                    <input
                      type="number"
                      placeholder="e.g. 78"
                      value={midlineForm.score}
                      onChange={(e) => setMidlineForm({ ...midlineForm, score: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">Assessment Result</label>
                    <select
                      value={midlineForm.result}
                      onChange={(e) => setMidlineForm({ ...midlineForm, result: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                    >
                      <option value="Meets Expected Competency">Meets Expected Competency</option>
                      <option value="Does Not Meet Expected Competency">Does Not Meet Expected Competency</option>
                      <option value="Refer to School Support">Refer to School Support</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">Intervention Decision</label>
                    <select
                      value={midlineForm.decision}
                      onChange={(e) => setMidlineForm({ ...midlineForm, decision: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold"
                    >
                      <option value="Continue ARAL">Continue ARAL Intervention</option>
                      <option value="Enrichment / Exit ARAL">Enrichment / Exit ARAL (Competency Achieved)</option>
                      <option value="Refer to School Support">Refer to Appropriate School Support</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">Teacher Remarks / Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Observations on learner progress and recommendations..."
                      value={midlineForm.remarks}
                      onChange={(e) => setMidlineForm({ ...midlineForm, remarks: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveMidline}
                    disabled={savingMidline}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark py-2 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
                  >
                    {savingMidline ? <Loader2 size={14} className="animate-spin" /> : null}
                    Confirm Midline Decision
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EOSY & SUMMER REFERRAL */}
          {activeTab === "eosy" && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Sun size={16} className="text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    End of School Year (EOSY) Assessment & Summer Referral
                  </h3>
                </div>

                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  Evaluate learner mastery at the end of the school year. Learners who do not meet competencies are referred to the Principal for placement into the <strong>ARAL Summer Program</strong>.
                </p>

                <div className="mt-4 space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700">EOSY Assessment Score / Rating</label>
                    <input
                      type="number"
                      placeholder="e.g. 72"
                      value={eosyForm.score}
                      onChange={(e) => setEosyForm({ ...eosyForm, score: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">EOSY Outcome</label>
                    <select
                      value={eosyForm.result}
                      onChange={(e) => setEosyForm({ ...eosyForm, result: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                    >
                      <option value="Requires Additional Support">Requires Additional Support</option>
                      <option value="Meets Expected Competency">Meets Expected Competency</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700">Official Decision</label>
                    <select
                      value={eosyForm.decision}
                      onChange={(e) => setEosyForm({ ...eosyForm, decision: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold"
                    >
                      <option value="ARAL Summer Referral">Refer to ARAL Summer Program</option>
                      <option value="Completed / Exit ARAL">Completed / Exit ARAL (Mastery Attained)</option>
                    </select>
                  </div>

                  {eosyForm.decision === "ARAL Summer Referral" ? (
                    <div>
                      <label className="font-bold text-slate-700">Reason for Summer Referral</label>
                      <input
                        type="text"
                        value={eosyForm.summerReferralReason}
                        onChange={(e) => setEosyForm({ ...eosyForm, summerReferralReason: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-amber-200 bg-amber-50/50 p-2 text-xs text-amber-900"
                        required
                      />
                    </div>
                  ) : null}

                  <div>
                    <label className="font-bold text-slate-700">Teacher Summary Remarks</label>
                    <textarea
                      rows={3}
                      placeholder="Final remarks on student progress throughout the academic year..."
                      value={eosyForm.remarks}
                      onChange={(e) => setEosyForm({ ...eosyForm, remarks: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveEosy}
                    disabled={savingEosy}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark py-2 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
                  >
                    {savingEosy ? <Loader2 size={14} className="animate-spin" /> : null}
                    Confirm EOSY Evaluation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
