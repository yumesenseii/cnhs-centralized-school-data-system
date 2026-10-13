"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Menu, Search } from "lucide-react";
import { loginContent, LOGIN_COLORS } from "@/lib/constants/loginContent";
import { cn } from "@/lib/utils";
import { Dashboard1 } from "@/components/ui/dashboard-1";
import EnrollmentByGradeChart from "@/components/landing/EnrollmentByGradeChart";

function PortalLoginButton({ scrolled, className = "" }) {
  return (
    <Link
      href="/login"
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-[11px] font-bold uppercase tracking-[0.04em] shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c430]",
        scrolled
          ? "bg-cnhs-green-dark text-white hover:bg-[#246f54]"
          : "text-[#123D2C] hover:bg-[#ffda45] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b4027]",
        className
      )}
      style={scrolled ? undefined : { backgroundColor: LOGIN_COLORS.gold }}
    >
      Log in
      <ArrowRight size={12} />
    </Link>
  );
}

function DotGrid({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute grid grid-cols-5 gap-2 ${className}`}
    >
      {Array.from({ length: 25 }).map((_, index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-cnhs-green/80 ring-1 ring-white/20"
        />
      ))}
    </span>
  );
}

function HeroMotif() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-[18%] z-[2] hidden h-52 w-52 rotate-[-12deg] lg:block"
      >
        <span className="absolute left-0 top-1 h-36 w-20 rounded-r-[4rem] bg-[#087738]/90" />
        <span className="absolute left-10 top-20 h-14 w-40 rotate-[28deg] bg-[#f8c719]" />
        <span className="absolute left-28 top-4 h-24 w-20 rotate-[-20deg] bg-[#0a6634]" />
        <span className="absolute left-24 top-28 h-16 w-16 rotate-[-10deg] border-[16px] border-[#087738] bg-transparent" />
        <DotGrid className="left-40 top-2 rotate-[8deg]" />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 bottom-0 z-[2] hidden h-40 w-40 rotate-[16deg] xl:block"
      >
        <span className="absolute bottom-0 right-8 h-28 w-16 rounded-t-full bg-[#087738]/90" />
        <span className="absolute bottom-5 right-20 h-12 w-28 bg-[#f8c719]" />
        <span className="absolute bottom-14 right-3 h-14 w-14 border-[14px] border-[#0a6634]" />
        <DotGrid className="bottom-20 right-24 scale-75" />
      </div>
    </>
  );
}

function BrandLogo({ scrolled = false, size = "md" }) {
  const dim = size === "lg" ? "h-12 w-12 sm:h-14 sm:w-14" : "h-11 w-11 sm:h-12 sm:w-12";
  return (
    <motion.div
      whileHover={{ scale: 1.06, rotate: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-white shadow-[0_6px_18px_rgba(0,0,0,0.12)] ring-2 transition-shadow duration-300",
        scrolled ? "ring-cnhs-green-dark/15" : "ring-white/40",
        dim
      )}
    >
      <Image
        src="/cnhs-logo.png"
        alt="Cambaog National High School logo"
        width={56}
        height={56}
        data-keep-white="true"
        className="h-full w-full object-contain p-0.5"
        priority={size !== "lg"}
      />
    </motion.div>
  );
}

export default function PortalLanding({ demographics }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const itemRefs = useRef({});
  const isProgrammaticScroll = useRef(false);
  const scrollLockTimeoutRef = useRef(null);

  const navigation = [
    { label: "Home", href: "#home", id: "home" },
    { label: "About", href: "#about", id: "about" },
    { label: "Academics", href: "#academics", id: "academics" },
    { label: "Contact", href: "#contact", id: "contact" },
  ];

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const updateIndicator = useCallback((sectionId = activeSection) => {
    const targetEl = itemRefs.current[sectionId];
    if (!targetEl) return;
    setIndicatorStyle({
      left: targetEl.offsetLeft,
      width: targetEl.offsetWidth,
    });
  }, [activeSection]);

  useEffect(() => {
    updateIndicator(activeSection);
  }, [activeSection, updateIndicator]);

  useEffect(() => {
    const onResize = () => updateIndicator(activeSection);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [activeSection, updateIndicator]);

  const unlockScroll = useCallback(() => {
    isProgrammaticScroll.current = false;
    if (scrollLockTimeoutRef.current) {
      clearTimeout(scrollLockTimeoutRef.current);
      scrollLockTimeoutRef.current = null;
    }
    window.removeEventListener("scrollend", unlockScroll);
  }, []);

  const handleNavClick = useCallback(
    (e, id, href) => {
      if (e) e.preventDefault();

      // 1. Immediately update active state & indicator position
      setActiveSection(id);
      updateIndicator(id);

      // 2. Lock IntersectionObserver during programmatic scrolling
      isProgrammaticScroll.current = true;
      if (scrollLockTimeoutRef.current) {
        clearTimeout(scrollLockTimeoutRef.current);
      }

      if ("onscrollend" in window) {
        window.addEventListener("scrollend", unlockScroll, { once: true });
      }
      scrollLockTimeoutRef.current = setTimeout(
        unlockScroll,
        prefersReducedMotion ? 50 : 850
      );

      // 3. Scroll to target element with 72px sticky header offset
      const target = document.getElementById(id);
      if (target) {
        const headerOffset = 72;
        const elementTop = target.getBoundingClientRect().top + window.scrollY;
        const targetY = id === "home" ? 0 : Math.max(0, elementTop - headerOffset);

        window.scrollTo({
          top: targetY,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      }

      // 4. Update URL hash without reloading the page
      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState(null, "", href);
      }
    },
    [prefersReducedMotion, unlockScroll, updateIndicator]
  );

  const determineActiveSection = useCallback(() => {
    if (isProgrammaticScroll.current) return;

    const contactEl = document.getElementById("contact");
    const academicsEl = document.getElementById("academics");
    const aboutEl = document.getElementById("about");

    const windowHeight = window.innerHeight;
    const headerThreshold = 140; // 72px fixed header + reading offset

    // 1. Contact (footer): active when footer enters main reading viewport
    if (contactEl) {
      const contactTop = contactEl.getBoundingClientRect().top;
      if (contactTop <= windowHeight * 0.55) {
        setActiveSection((prev) => (prev !== "contact" ? "contact" : prev));
        return;
      }
    }

    // 2. Academics: active when academics section reaches or passes sticky header
    if (academicsEl) {
      const academicsTop = academicsEl.getBoundingClientRect().top;
      if (academicsTop <= headerThreshold) {
        setActiveSection((prev) => (prev !== "academics" ? "academics" : prev));
        return;
      }
    }

    // 3. About: active when about section reaches or passes sticky header
    if (aboutEl) {
      const aboutTop = aboutEl.getBoundingClientRect().top;
      if (aboutTop <= headerThreshold) {
        setActiveSection((prev) => (prev !== "about" ? "about" : prev));
        return;
      }
    }

    // 4. Default: Home
    setActiveSection((prev) => (prev !== "home" ? "home" : prev));
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
      determineActiveSection();
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [determineActiveSection]);

  useEffect(() => {
    const sectionIds = ["home", "about", "academics", "contact"];
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      () => {
        determineActiveSection();
      },
      {
        rootMargin: "-72px 0px -20% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [determineActiveSection]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  return (
    <div
      data-force-light="true"
      data-keep-white="true"
      style={{ colorScheme: "light" }}
      className="min-h-screen overflow-x-hidden bg-[#f7faf7] text-slate-900"
    >
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-30 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300",
          scrolled
            ? "border-b border-slate-200/80 bg-white/95 shadow-[0_8px_28px_rgba(15,23,42,0.08)] backdrop-blur-md"
            : "border-b border-transparent bg-transparent shadow-none"
        )}
      >
        <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
          <Link
            href="#home"
            onClick={(e) => handleNavClick(e, "home", "#home")}
            aria-label="CNHS home"
            className="group flex min-w-0 cursor-pointer items-center gap-3"
          >
            <BrandLogo scrolled={scrolled} />
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-[14px] font-bold uppercase tracking-[-0.01em] transition-colors duration-300 sm:text-[17px]",
                  scrolled ? "text-[#123d2c]" : "text-white"
                )}
              >
                Cambaog National High School
              </p>
              <p
                className={cn(
                  "hidden text-[10px] transition-colors duration-300 sm:block",
                  scrolled ? "text-slate-500" : "text-white/70"
                )}
              >
                CNHS Learn · Cambaog, Bustos, Bulacan
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <nav
              ref={(el) => {
                if (el) itemRefs.current.__nav = el;
              }}
              aria-label="Main navigation"
              className="relative hidden items-center gap-5 lg:flex"
            >
              {navigation.map(({ label, href, id }) => {
                const isActive = activeSection === id;
                return (
                  <a
                    key={id}
                    ref={(el) => {
                      if (el) itemRefs.current[id] = el;
                    }}
                    href={href}
                    onClick={(e) => handleNavClick(e, id, href)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "cursor-pointer py-2 text-[9px] font-semibold uppercase tracking-[0.05em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c430] rounded-xs",
                      isActive
                        ? scrolled
                          ? "text-[#123d2c] font-bold"
                          : "text-white font-bold"
                        : scrolled
                          ? "text-slate-500 hover:text-[#123d2c]"
                          : "text-white/75 hover:text-white"
                    )}
                  >
                    {label}
                  </a>
                );
              })}
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute bottom-0 h-[2.5px] rounded-full bg-[#f4c430] ease-out",
                  prefersReducedMotion
                    ? "transition-none"
                    : "transition-[transform,width] duration-200",
                  indicatorStyle.width === 0 && "opacity-0"
                )}
                style={{
                  transform: `translateX(${indicatorStyle.left}px)`,
                  width: `${indicatorStyle.width}px`,
                }}
              />
              <button
                type="button"
                aria-label="Search"
                className={cn(
                  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c430]",
                  scrolled
                    ? "text-slate-500 hover:bg-slate-100 hover:text-[#123d2c]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <Search size={14} />
              </button>
            </nav>
            <PortalLoginButton scrolled={scrolled} />
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
              className={cn(
                "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c430] lg:hidden",
                scrolled
                  ? "border border-slate-200 text-[#123d2c] hover:bg-slate-50"
                  : "border border-white/15 text-white hover:bg-white/10"
              )}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        {mobileNavOpen ? (
          <motion.nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-x-4 top-[4.85rem] overflow-hidden rounded-xl border border-slate-100 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.16)] lg:hidden"
          >
            {navigation.map(({ label, href, id }) => {
              const isActive = activeSection === id;
              return (
                <a
                  key={id}
                  href={href}
                  onClick={(e) => {
                    handleNavClick(e, id, href);
                    setMobileNavOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "block cursor-pointer rounded-lg px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c430]",
                    isActive
                      ? "bg-green-50 text-cnhs-green-dark border-l-2 border-[#f4c430] font-bold"
                      : "text-slate-600 hover:bg-green-50/50 hover:text-cnhs-green-dark"
                  )}
                >
                  {label}
                </a>
              );
            })}
          </motion.nav>
        ) : null}
      </header>

      <main>
        <section
          id="home"
          className="relative min-h-[640px] overflow-hidden bg-[#0a4c2a] sm:min-h-[720px]"
        >
          <Image
            src={loginContent.backgroundSrc}
            alt="Cambaog National High School campus with the Philippine flag"
            fill
            priority
            className="object-cover object-[62%_center]"
            sizes="100vw"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(4,64,31,0.93) 0%, rgba(4,77,36,0.78) 31%, rgba(5,72,34,0.28) 62%, rgba(4,49,25,0.18) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage:
                "linear-gradient(110deg, rgba(244,196,48,0.12) 0%, transparent 22%), linear-gradient(to top, rgba(3,43,21,0.55), transparent 45%)",
            }}
          />
          <HeroMotif />

          <div className="relative z-10 mx-auto flex min-h-[560px] max-w-[1440px] items-center px-6 pb-20 pt-28 sm:min-h-[640px] sm:px-10 sm:pt-32 lg:px-28 xl:px-36">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-[650px]"
            >
              <h1 className="text-[2.55rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-white sm:text-[3.7rem] lg:text-[4.3rem]">
                <span className="text-[#f4c430]">Em</span>powering Minds.
                <br />
                Shaping <span className="text-[#f4c430]">Futures.</span>
              </h1>
              <p className="mt-5 max-w-[520px] text-[13px] leading-relaxed text-white/90 sm:text-[15px]">
                Cambaog National High School is dedicated to providing quality
                education that inspires excellence, character, and lifelong
                learning.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PortalLoginButton scrolled={false} />
                <a
                  href="#about"
                  onClick={(e) => handleNavClick(e, "about", "#about")}
                  className="inline-flex h-9 cursor-pointer items-center rounded-full border border-white/35 bg-white/10 px-4 text-[11px] font-bold uppercase tracking-[0.04em] text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  Learn more
                </a>
              </div>
            </motion.div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-16 sm:h-20">
            <svg
              viewBox="0 0 1440 80"
              preserveAspectRatio="none"
              className="h-full w-full"
              aria-hidden="true"
            >
              <path
                d="M0,40 C240,80 480,0 720,36 C960,72 1200,8 1440,44 L1440,80 L0,80 Z"
                fill="#f7faf7"
              />
            </svg>
          </div>
        </section>

        {demographics && (
          <section className="bg-white py-16 sm:py-24">
            <div className="mx-auto max-w-6xl px-5 sm:px-8">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold tracking-tight text-[#123d2c] sm:text-4xl">
                  CNHS Enrollment Overview
                </h2>
                <p className="mt-3 text-[15px] text-slate-500">
                  A quick look at learner enrollment across grade levels for the current school year.
                </p>
              </div>
              <Dashboard1 data={demographics} />
              <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-xs">
                <EnrollmentByGradeChart data={demographics} />
              </div>
            </div>
          </section>
        )}

        <section
          id="about"
          className="relative bg-[#f7faf7] px-5 py-20 sm:px-8 sm:py-24"
        >
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-[500px] overflow-hidden rounded-2xl bg-[#0b4d2c] shadow-[0_18px_45px_rgba(14,50,37,0.18)]">
              <Image
                src="/assets/images/login/cnhs-building.png"
                alt="CNHS campus"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#073d25]/45 to-transparent" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cnhs-green-dark">
                About CNHS
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[#123d2c] sm:text-4xl">
                Education rooted in character and community.
              </h2>
              <p className="mt-5 max-w-2xl text-[14px] leading-7 text-slate-600">
                We support learners through responsible teaching, transparent
                academic monitoring, and programs that respond to individual
                needs. CNHS Learn connects school leaders, teachers, and
                students through one secure system.
              </p>
            </div>
          </div>
        </section>

        <section
          id="academics"
          className="border-y border-green-100 bg-white px-5 py-16 sm:px-8"
        >
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cnhs-green-dark">
              Academics & learner support
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-[#123d2c] sm:text-3xl">
              One school community, focused on learner progress.
            </h2>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {[
                [
                  "Academic Records",
                  "Consistent, term-based class records and performance reporting.",
                ],
                [
                  "Learner Monitoring",
                  "Grades-based intervention and ARAL recommendations for timely support.",
                ],
                [
                  "Lesson Planning",
                  "Structured submission and review workflows for instructional quality.",
                ],
              ].map(([title, description]) => (
                <article
                  key={title}
                  className="rounded-2xl border border-slate-100 bg-[#f8fbf8] p-6 text-left shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
                >
                  <h3 className="text-[15px] font-bold text-[#123d2c]">
                    {title}
                  </h3>
                  <p className="mt-2 text-[12px] leading-6 text-slate-500">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="relative overflow-hidden text-white">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #052918 0%, #0a4c2a 42%, #0d6b4a 72%, #0e7a78 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full opacity-30 blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(244,196,48,0.35) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full opacity-25 blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.25) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex max-w-md items-start gap-3.5">
              <BrandLogo scrolled size="lg" />
              <div>
                <p className="text-[16px] font-semibold tracking-tight text-white">
                  {loginContent.schoolName}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-white/70">
                  Centralized school data for grades, attendance, ARAL, and
                  learner monitoring — built for CNHS.
                </p>
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/85">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Cambaog, Bustos, Bulacan
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                  Explore
                </p>
                <ul className="mt-3 space-y-2">
                  {navigation.map(({ label, href, id }) => (
                    <li key={label}>
                      <a
                        href={href}
                        onClick={(e) => handleNavClick(e, id, href)}
                        className="cursor-pointer text-[12px] text-white/75 transition-colors hover:text-white"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                  Portal
                </p>
                <p className="mt-3 max-w-[220px] text-[12px] leading-5 text-white/70">
                  Authorized personnel can sign in to CNHS Learn.
                </p>
                <PortalLoginButton scrolled={false} className="mt-4" />
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-5">
            <p className="text-[10px] text-white/45">
              © {new Date().getFullYear()} CNHS Learn · Cambaog National High
              School
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
