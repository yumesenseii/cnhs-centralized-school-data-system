"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import {
  aralAssessmentPhaseLabel,
} from "@/lib/monitoring/aralAssessments";
import {
  createAralAssessmentComment,
  listAralAssessmentComments,
} from "@/lib/supabase/queries/aralProgram";
import { useAppToast } from "@/components/shared/AppToast";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

/**
 * ARAL section comments — admin can post; facilitator read-only.
 */
export default function AralAssessmentComments({
  batchId = null,
  gradeSection = "",
  phase = undefined,
  canPost = false,
  profileId = null,
  title = "HT comments",
  hideWhenEmpty = false,
}) {
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useAppToast();
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [scopePhase, setScopePhase] = useState(
    phase === "pre" || phase === "mid" || phase === "post" ? phase : ""
  );

  useEffect(() => {
    if (phase === "pre" || phase === "mid" || phase === "post") {
      setScopePhase(phase);
    } else if (phase === undefined) {
      setScopePhase("");
    }
  }, [phase]);

  const refresh = useCallback(async () => {
    if (!batchId || !gradeSection) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const result = await listAralAssessmentComments({
      batchId,
      gradeSection,
      phase,
      includeSectionWide: true,
    });
    if (result.error) {
      setError(result.error.message);
      setComments([]);
    } else {
      setComments(result.data ?? []);
    }
    setLoading(false);
  }, [batchId, gradeSection, phase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handlePost() {
    if (!canPost || !draft.trim()) return;
    setPosting(true);
    setError("");
    const result = await createAralAssessmentComment({
      batchId,
      gradeSection,
      phase: scopePhase || null,
      body: draft,
      createdByProfileId: profileId,
    });
    setPosting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setDraft("");
    showToast("Comment posted for the facilitator.");
    await refresh();
  }

  if (hideWhenEmpty && !canPost) {
    if (loading) return null;
    if (!error && comments.length === 0) return null;
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-white/10 dark:bg-white/4">
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare size={14} className="text-cnhs-green-dark dark:text-cnhs-green" />
        <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      </div>

      {error ? (
        <p className="mb-2 text-[12px] font-medium text-red-600">{error}</p>
      ) : null}

      {canPost ? (
        <div className="mb-3 space-y-2">
          <div className="block text-[11px] font-medium text-slate-500">
            Scope
            <AppSelect
              label="Scope"
              value={scopePhase}
              onChange={setScopePhase}
              options={[
                { value: "", label: "Whole section" },
                { value: "pre", label: "Pre-Test" },
                { value: "mid", label: "Mid-Test" },
                { value: "post", label: "Post-Test" },
              ]}
              className="mt-1 w-full max-w-xs"
              triggerClassName="h-8 rounded-lg px-2 text-[12px]"
            />
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="e.g. Please recheck Pre-Test scores for Mabini…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800 outline-none focus:border-cnhs-green"
          />
          <button
            type="button"
            disabled={posting || !draft.trim() || !batchId}
            onClick={handlePost}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {posting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
            Post comment
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-[12px] text-slate-500">
          <Loader2 size={14} className="animate-spin" />
          Loading comments…
        </div>
      ) : comments.length === 0 ? (
        <p className="py-2 text-[12px] text-slate-400">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-lg border border-slate-100 bg-white px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                <span className="font-semibold text-slate-600">
                  {comment.authorName || "Head Teacher"}
                </span>
                <span>·</span>
                <span>{formatWhen(comment.createdAt)}</span>
                <span>·</span>
                <span>
                  {comment.phase
                    ? aralAssessmentPhaseLabel(comment.phase)
                    : "Section"}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[12px] text-slate-700">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
