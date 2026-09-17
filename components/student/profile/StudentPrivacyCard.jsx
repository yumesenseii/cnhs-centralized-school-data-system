"use client";

import { useEffect, useState } from "react";
import { Check, FileText, Loader2 } from "lucide-react";
import { loginContent } from "@/lib/constants/loginContent";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const { form } = loginContent;

export default function StudentPrivacyCard() {
  const { acceptTermsOfUse } = useAuth();
  const [acceptedAt, setAcceptedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("accepted_terms_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    setAcceptedAt(data?.accepted_terms_at ?? null);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAccept() {
    setError("");
    setSuccess("");
    setSaving(true);
    const result = await acceptTermsOfUse();
    setSaving(false);
    if (result.error) {
      setError(result.error.message || "Unable to save acceptance.");
      return;
    }
    setAcceptedAt(result.data?.accepted_terms_at ?? new Date().toISOString());
    setSuccess("Terms of Use and Privacy Policy accepted.");
  }

  const acceptedLabel = acceptedAt
    ? new Date(acceptedAt).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
        <div className="mb-2.5 border-b border-border pb-2.5">
          <h2 className="text-[13px] font-semibold text-card-foreground">Privacy</h2>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            Review Terms of Use and Privacy Policy. Acceptance is required.
          </p>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-[12px] text-slate-500">
            <Loader2 size={14} className="animate-spin" />
            Loading…
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  acceptedAt
                    ? "inline-flex items-center gap-1 rounded-full bg-cnhs-green-soft px-2.5 py-1 text-[10px] font-semibold text-cnhs-green-dark"
                    : "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800"
                }
              >
                {acceptedAt ? <Check size={12} /> : null}
                {acceptedAt ? "Accepted" : "Not accepted yet"}
              </span>
              {acceptedLabel ? (
                <span className="text-[11px] text-slate-500">
                  on {acceptedLabel}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[11px] font-semibold text-card-foreground transition-colors duration-200 hover:bg-muted"
            >
              <FileText size={13} />
              View Terms of Use and Privacy Policy
            </button>

            {!acceptedAt ? (
              <button
                type="button"
                onClick={handleAccept}
                disabled={saving}
                className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors duration-200 hover:bg-[#246f54] active:bg-[#1f5f48] disabled:opacity-60 sm:w-auto"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                I accept the Terms and Privacy Policy
              </button>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] text-red-600">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-lg border border-green-100 bg-green-50 px-2.5 py-2 text-[11px] font-medium text-cnhs-green-dark">
                {success}
              </p>
            ) : null}
          </div>
        )}
      </section>

      {termsOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            aria-label="Close terms"
            onClick={() => setTermsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-privacy-terms-title"
            className="relative z-10 flex w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
            data-force-light="true"
            data-keep-white="true"
          >
            <div className="px-6 pt-5 pb-3">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#174D37]">
                {form.firstLoginTermsSchool}
              </p>
              <p className="mt-1 text-center text-[12px] font-medium text-slate-500">
                {form.firstLoginTermsSystem}
              </p>
              <h2
                id="student-privacy-terms-title"
                className="mt-2 text-center text-[17px] font-semibold tracking-[-0.02em] text-slate-900"
              >
                {form.firstLoginTermsTitle}
              </h2>
              <p className="mt-1 text-center text-[12px] italic text-slate-500">
                {form.firstLoginTermsEffective}
              </p>
              <div className="mt-3 h-px bg-[#174D37]" />
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-2">
              {(form.firstLoginTermsArticles ?? []).map((article) => (
                <section key={article.number} className="mb-4 last:mb-3">
                  <h3 className="text-[13px] font-bold text-slate-900">
                    {article.number}. {article.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-7 text-slate-600">
                    {article.body}
                  </p>
                </section>
              ))}
            </div>
            <div className="flex justify-end border-t border-slate-100 px-6 py-3">
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="inline-flex h-9 cursor-pointer items-center rounded-full bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white transition-colors duration-200 hover:bg-[#246f54] active:bg-[#1f5f48]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
