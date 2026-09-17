"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import {
  hasCompletedTour,
  markTourCompleted,
} from "@/lib/onboarding/guidedTourStorage";
import {
  ADMIN_TOUR_STEPS,
  TEACHER_TOUR_STEPS,
} from "@/lib/onboarding/tourSteps";

const PAD = 8;

function rectFromEl(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    bottom: rect.bottom,
    right: rect.right,
  };
}

function isVisiblyPainted(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number(style.opacity) === 0) return false;
  return true;
}

function measureTarget(tourId) {
  if (typeof document === "undefined" || !tourId) return null;
  const nodes = document.querySelectorAll(`[data-tour-id="${tourId}"]`);
  let fallback = null;
  for (const el of nodes) {
    if (!isVisiblyPainted(el)) continue;
    const box = rectFromEl(el);
    if (!box) continue;
    const inView =
      box.bottom > 0 &&
      box.top < window.innerHeight &&
      box.right > 0 &&
      box.left < window.innerWidth;
    if (inView) return box;
    if (!fallback) fallback = box;
  }
  return fallback;
}

/**
 * First-time coach-mark tour — spotlights sidebar targets.
 * role: "admin" | "teacher"
 */
export default function GuidedTour({ role = "teacher" }) {
  const steps = role === "admin" ? ADMIN_TOUR_STEPS : TEACHER_TOUR_STEPS;
  const [userId, setUserId] = useState(null);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user?.id) return;
      setUserId(user.id);
      if (!hasCompletedTour(role, user.id)) {
        // Wait for sidebar paint (desktop + mobile sheet may differ).
        window.setTimeout(() => {
          if (!cancelled) setActive(true);
        }, 450);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const refreshBox = useCallback(() => {
    const step = steps[index];
    if (!step) {
      setBox(null);
      return;
    }
    setBox(measureTarget(step.id));
  }, [index, steps]);

  useEffect(() => {
    if (!active) return undefined;
    refreshBox();
    const onResize = () => refreshBox();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const timer = window.setInterval(refreshBox, 500);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearInterval(timer);
    };
  }, [active, refreshBox]);

  function finish() {
    if (userId) markTourCompleted(role, userId);
    setActive(false);
  }

  function next() {
    if (index >= steps.length - 1) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  }

  if (!mounted || !active || typeof document === "undefined") return null;

  const step = steps[index];
  const isLast = index >= steps.length - 1;
  const tipWidth = Math.min(288, typeof window !== "undefined" ? window.innerWidth - 32 : 288);
  let tipTop = typeof window !== "undefined" ? Math.max(80, window.innerHeight / 2 - 60) : 80;
  let tipLeft = 24;
  if (box && typeof window !== "undefined") {
    const preferRight = box.left + box.width + 12 + tipWidth <= window.innerWidth - 8;
    tipLeft = preferRight
      ? box.left + box.width + 12
      : Math.max(16, Math.min(box.left, window.innerWidth - tipWidth - 16));
    tipTop = Math.min(
      Math.max(12, box.top),
      window.innerHeight - 170
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Dim — four panes around the spotlight cutout */}
      {box ? (
        <>
          <div
            className="absolute bg-slate-900/55"
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, box.top) }}
          />
          <div
            className="absolute bg-slate-900/55"
            style={{
              top: box.top + box.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <div
            className="absolute bg-slate-900/55"
            style={{
              top: box.top,
              left: 0,
              width: Math.max(0, box.left),
              height: box.height,
            }}
          />
          <div
            className="absolute bg-slate-900/55"
            style={{
              top: box.top,
              left: box.left + box.width,
              right: 0,
              height: box.height,
            }}
          />
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-cnhs-green shadow-[0_0_0_4px_rgba(34,139,84,0.35)]"
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              height: box.height,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-slate-900/55" />
      )}

      <div
        className="absolute z-10 rounded-xl border border-cnhs-green-dark/20 bg-white p-3 shadow-xl"
        style={{ top: tipTop, left: tipLeft, width: tipWidth }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-cnhs-green-dark">
          Step {index + 1} of {steps.length}
        </p>
        <p className="mt-1 text-[13px] font-semibold text-slate-900">
          {step?.title}
        </p>
        <p className="mt-1 text-[12px] leading-5 text-slate-600">
          {box
            ? step?.tip
            : `Open the menu and go to ${step?.title}. ${step?.tip}`}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={next}
            className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54]"
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
