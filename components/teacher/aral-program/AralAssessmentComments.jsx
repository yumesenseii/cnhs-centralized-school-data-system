"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import {
  aralAssessmentPhaseLabel,
} from "@/lib/monitoring/aralAssessments";
import {
  createAralAssessmentComment,
  listAralAssessmentComments,
} from "@/lib/supabase/queries/aralProgram";

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
}) {
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
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
    setToast("");
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
    setToast("Comment posted for the facilitator.");
    await refresh();
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare size={14} className="text-sky-700" />
        <p className="text-[12px] font-semibold text-slate-800">{title}</p>
      </div>

      {error ? (
        <p className="mb-2 text-[12px] font-medium text-red-600">{error}</p>
      ) : null}
      {toast ? (
        <p className="mb-2 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </p>
      ) : null}

      {canPost ? (
        <div className="mb-3 space-y-2">
          <label className="block text-[11px] font-medium text-slate-500">
            Scope
            <select
              value={scopePhase}
              onChange={(e) => setScopePhase(e.target.value)}
              className="mt-1 h-8 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-2 text-[12px] outline-none focus:border-cnhs-green"
            >
              <option value="">Whole section</option>
              <option value="pre">Pre-Test</option>
              <option value="mid">Mid-Test</option>
              <option value="post">Post-Test</option>
            </select>
          </label>
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
