"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Check, AlertTriangle, Loader2 } from "lucide-react";
import { getStudentAttendanceHistory } from "@/lib/supabase/queries/attendance";
import { submitInitialScreeningValidation } from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function ValidationWizardModal({
  monitoringRecordId,
  studentId,
  learnerName,
  onClose,
  onSuccess,
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { showToast } = useAppToast();

  // Step 1 State
  const [philIriScore, setPhilIriScore] = useState("");
  const [crlaScore, setCrlaScore] = useState("");

  // Step 2 State
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  // Step 3 State
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    async function loadAttendance() {
      setAttendanceLoading(true);
      const { data } = await getStudentAttendanceHistory(studentId);
      setAttendanceRecords(data?.records || []);
      setAttendanceLoading(false);
    }
    loadAttendance();
  }, [studentId]);

  const totalAbsences = attendanceRecords.reduce((sum, r) => sum + (r.absent_days || 0), 0);
  const hasAttendanceData = attendanceRecords.length > 0;

  const handleNext = () => setStep((s) => Math.min(s + 1, 3));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setLoading(true);
    const { error } = await submitInitialScreeningValidation({
      monitoringRecordId,
      philIriScore: philIriScore || null,
      crlaScore: crlaScore || null,
      hasParentalConsent: hasConsent,
    });
    setLoading(false);

    if (error) {
      showToast("error", error.message || "Failed to submit review.");
    } else {
      showToast("success", "Review completed. Student list updated.");
      onSuccess?.();
    }
  };

  const isNextDisabled = () => {
    if (step === 1) return !philIriScore && !crlaScore;
    if (step === 3) return !hasConsent;
    return false;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Needs ARAL Review: 3-Step Check-off</h2>
            <p className="text-sm text-slate-500">{learnerName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center px-6 pt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-1 items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold border-2 transition-colors",
                  step === i
                    ? "border-blue-600 bg-blue-600 text-white"
                    : step > i
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-400"
                )}
              >
                {step > i ? <Check size={16} /> : i}
              </div>
              {i < 3 && (
                <div
                  className={cn(
                    "mx-2 h-1 flex-1 rounded-full transition-colors",
                    step > i ? "bg-blue-600" : "bg-slate-100"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-[280px] p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Step 1: Reading Diagnostic Scores</h3>
                  <p className="text-sm text-slate-500">
                    Provide scores from the physical reading assessment booklets.
                    At least one score is required to proceed.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Phil-IRI Score (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full rounded-lg border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. 75"
                      value={philIriScore}
                      onChange={(e) => setPhilIriScore(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      CRLA Score (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full rounded-lg border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. 80"
                      value={crlaScore}
                      onChange={(e) => setCrlaScore(e.target.value)}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Step 2: Attendance Review</h3>
                  <p className="text-sm text-slate-500">
                    Review the learner's attendance record to determine if low grades are driven by chronic absenteeism.
                  </p>
                </div>
                
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  {attendanceLoading ? (
                    <div className="flex items-center justify-center py-6 text-slate-400">
                      <Loader2 size={24} className="animate-spin" />
                    </div>
                  ) : hasAttendanceData ? (
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Total Consolidated Absences</p>
                        <p className="text-2xl font-bold text-slate-900">{totalAbsences} <span className="text-sm font-normal text-slate-500">days</span></p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm font-medium text-slate-600">No attendance data consolidated yet.</p>
                      <p className="text-xs text-slate-500 mt-1">You may still proceed with review.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Step 3: Parental Consent Check-off</h3>
                  <p className="text-sm text-slate-500">
                    Verify that you have obtained proper authorization before onboarding the learner into ARAL Monitoring.
                  </p>
                </div>
                
                <label className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 cursor-pointer hover:bg-blue-50 transition-colors">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={hasConsent}
                    onChange={(e) => setHasConsent(e.target.checked)}
                  />
                  <div>
                    <p className="font-semibold text-blue-900">Parental Consent Confirmed</p>
                    <p className="text-sm text-blue-800">
                      I confirm that a signed Parental Consent Form is on file for this learner.
                    </p>
                  </div>
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            onClick={step === 1 ? onClose : handlePrev}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            {step === 1 ? "Cancel" : <><ChevronLeft size={16} /> Back</>}
          </button>
          
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={isNextDisabled() || loading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isNextDisabled() || loading}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Complete Check-off
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
