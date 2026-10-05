"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, BookOpen, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Official DepEd CNHS Lesson Plan Section Registry.
 * Based on the prescribed DepEd DLP (DO 3 s.2026 / DO 42 s.2016) format used in CNHS LEARN.
 */
export const OFFICIAL_CNHS_SECTIONS = [
  {
    key: "details",
    id: "lp-section-details",
    title: "Lesson Details",
    patterns: [
      /<strong><em>Lesson Title<\/em><\/strong>/i,
      /<p><strong>Lesson Title<\/strong><\/p>/i,
      /Lesson Title/i,
      /Republic of the Philippines/i,
    ],
  },
  {
    key: "intentions",
    id: "lp-section-intentions",
    title: "I. Intentions & Objectives",
    patterns: [
      /<p><strong>Intentions\.<\/strong><\/p>/i,
      /<strong>Intentions\.<\/strong>/i,
      /I\.\s*(?:Intentions|Objectives)/i,
      /Learning Competency and Curriculum Standards/i,
    ],
  },
  {
    key: "learner_context",
    id: "lp-section-learner-context",
    title: "II. Learner Context & Observations",
    patterns: [
      /<p><em>Learner Context:\s*<\/em><\/p>/i,
      /<em>Learner Context:<\/em>/i,
      /Learner Context:/i,
      /II\.\s*(?:Learner Context|Content)/i,
    ],
  },
  {
    key: "pre_lesson",
    id: "lp-section-pre-lesson",
    title: "III. Pre-Lesson Preparation",
    patterns: [
      /<p><em>Pre-Lesson:\s*<\/em><\/p>/i,
      /<em>Pre-Lesson:<\/em>/i,
      /<p><strong>Learning Experience\.<\/strong><\/p>/i,
      /Pre-Lesson:/i,
      /III\.\s*Pre-Lesson/i,
    ],
  },
  {
    key: "flow",
    id: "lp-section-flow",
    title: "IV. Learning Flow & Session Activities",
    patterns: [
      /<p><em>Flow:\s*<\/em><\/p>/i,
      /<em>Flow:<\/em>/i,
      /Flow:\s*<\/em>/i,
      /IV\.\s*(?:Learning Flow|Procedures)/i,
      /Teaching and Learning Procedures/i,
    ],
  },
  {
    key: "resources_integration",
    id: "lp-section-resources",
    title: "V. Learning Resources & Integration",
    patterns: [
      /<p><em>Learning Resources:\s*<\/em><\/p>/i,
      /<em>Learning Resources:<\/em>/i,
      /Learning Resources:/i,
      /V\.\s*Learning Resources/i,
      /Opportunities for integration/i,
    ],
  },
  {
    key: "assessment",
    id: "lp-section-assessment",
    title: "VI. Formative Assessment",
    patterns: [
      /<p><em>Formative Assessment:\s*<\/em><\/p>/i,
      /<p><strong>Assessment\.<\/strong><\/p>/i,
      /Formative Assessment:/i,
      /VI\.\s*(?:Formative Assessment|Assessment)/i,
    ],
  },
  {
    key: "ways_forward",
    id: "lp-section-ways-forward",
    title: "VII. Ways Forward & Reflections",
    patterns: [
      /<p><strong>Ways Forward\.<\/strong><\/p>/i,
      /<strong>Ways Forward\.<\/strong>/i,
      /Ways Forward\./i,
      /VII\.\s*Ways Forward/i,
      /Extended learning opportunities/i,
    ],
  },
];

/**
 * Injects official section anchor elements into the lesson plan HTML.
 * Only returns sections that actually exist in the document, keeping navigation 100% truthful.
 */
export function annotateLessonPlanHtml(html = "") {
  if (!html) return { annotatedHtml: "", availableSections: [] };

  let annotatedHtml = html;
  const availableSections = [];

  for (const sec of OFFICIAL_CNHS_SECTIONS) {
    let matched = false;
    for (const pattern of sec.patterns) {
      if (pattern.test(annotatedHtml)) {
        // Inject anchor span before the first occurrence
        annotatedHtml = annotatedHtml.replace(pattern, (match) => {
          if (!matched) {
            matched = true;
            return `<span id="${sec.id}" data-lp-section="${sec.key}" class="scroll-mt-24 block pointer-events-none -mt-2 pt-2"></span>${match}`;
          }
          return match;
        });
        if (matched) break;
      }
    }

    if (matched) {
      availableSections.push({
        key: sec.key,
        id: sec.id,
        title: sec.title,
      });
    }
  }

  // If no specific headings matched, provide top level details
  if (availableSections.length === 0 && html.length > 50) {
    availableSections.push({
      key: "details",
      id: "lp-section-details",
      title: "Lesson Details",
    });
    annotatedHtml = `<span id="lp-section-details" data-lp-section="details" class="scroll-mt-24 block pointer-events-none"></span>${annotatedHtml}`;
  }

  return { annotatedHtml, availableSections };
}

/**
 * Desktop & Mobile Lesson Plan Scrollspy Navigation.
 */
export default function LessonPlanScrollspy({
  sections = [],
  activeId = "",
  onSelectSection = null,
  variant = "all", // "all" | "desktop" | "mobile"
  className = "",
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close mobile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileMenuOpen]);

  if (!sections.length) return null;

  const activeSection = sections.find((s) => s.id === activeId) || sections[0];

  const handleItemClick = (e, section) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onSelectSection?.(section);
  };

  const showMobile = variant === "all" || variant === "mobile";
  const showDesktop = variant === "all" || variant === "desktop";

  return (
    <>
      {/* =========================================================================
          MOBILE COMPACT STICKY CONTROL (Sections dropdown)
          ========================================================================= */}
      {showMobile && (
        <div
          ref={dropdownRef}
          className={cn(
            "sticky top-0 z-30 mb-3 w-full bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-lg shadow-xs",
            variant === "all" && "lg:hidden",
            className
          )}
        >
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-sections-dropdown"
            aria-label="Sections: Click to view all sections"
            className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sections:
              </span>
              <span className="font-semibold text-cnhs-green-dark truncate">
                {activeSection?.title || "Lesson Overview"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 shrink-0 ml-2">
              <span className="text-[10px] font-medium text-slate-500">
                {sections.length} sections
              </span>
              {mobileMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {/* Mobile Dropdown Panel */}
          {mobileMenuOpen && (
            <nav
              id="mobile-sections-dropdown"
              aria-label="On this page"
              className="border-t border-slate-100 bg-white p-1.5 shadow-lg rounded-b-lg max-h-64 overflow-y-auto"
            >
              <ul className="space-y-0.5">
                {sections.map((sec) => {
                  const isActive = sec.id === activeId || (!activeId && sec === sections[0]);
                  return (
                    <li key={sec.id}>
                      <a
                        href={`#${sec.id}`}
                        onClick={(e) => handleItemClick(e, sec)}
                        aria-current={isActive ? "location" : undefined}
                        className={cn(
                          "flex items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors duration-200",
                          isActive
                            ? "bg-emerald-50 text-cnhs-green-dark font-semibold border-l-2 border-cnhs-green"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-2 border-transparent"
                        )}
                      >
                        <span className="truncate">{sec.title}</span>
                        {isActive && (
                          <span className="text-[10px] font-bold text-cnhs-green shrink-0 ml-2">
                            ●
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>
      )}

      {/* =========================================================================
          DESKTOP STICKY SIDEBAR NAVIGATION (On this page)
          ========================================================================= */}
      {showDesktop && (
        <nav
          aria-label="On this page"
          className={cn(
            "w-full transition-all",
            variant === "all" && "hidden lg:block",
            className
          )}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              On this page
            </h2>
            <span className="text-[10px] font-medium text-slate-400">
              {sections.length} parts
            </span>
          </div>

        <ul className="space-y-1">
          {sections.map((sec) => {
            const isActive = sec.id === activeId || (!activeId && sec === sections[0]);

            return (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  onClick={(e) => handleItemClick(e, sec)}
                  aria-current={isActive ? "location" : undefined}
                  className={cn(
                    "group flex items-center justify-between rounded-r-md py-1.5 pl-2.5 pr-2 text-[12px] leading-snug transition-all duration-200 ease-out border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green focus-visible:ring-offset-1",
                    isActive
                      ? "border-cnhs-green bg-emerald-50/60 font-semibold text-cnhs-green-dark shadow-xs"
                      : "border-transparent font-normal text-slate-600 hover:border-slate-300 hover:bg-slate-50/80 hover:text-slate-900"
                  )}
                >
                  <span className="truncate pr-1">{sec.title}</span>
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-cnhs-green shrink-0 animate-in fade-in"
                    />
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
        </nav>
      )}
    </>
  );
}
