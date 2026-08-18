"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, Search } from "lucide-react";
import { loginContent, LOGIN_COLORS } from "@/lib/constants/loginContent";

function PortalLoginButton({ className = "" }) {
  return (
    <Link
      href="/login"
      className={`inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 text-[11px] font-bold uppercase tracking-[0.04em] text-[#123D2C] shadow-sm transition-colors duration-200 hover:bg-[#ffda45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b4027] ${className}`}
      style={{ backgroundColor: LOGIN_COLORS.gold }}
    >
      CNHS Learn
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

/**
 * Abstract CNHS corner motif based on the supplied green / gold artwork.
 * Built as lightweight CSS shapes so it stays crisp and responsive.
 */
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

export default function PortalLanding() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navigation = [
    ["Home", "/"],
    ["About", "#about"],
    ["Academics", "#academics"],
    ["Contact", "#contact"],
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7faf7] text-slate-900">
      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/10 bg-[#073d25]/95 shadow-[0_4px_18px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
          <Link
            href="/"
            aria-label="CNHS home"
            className="flex min-w-0 cursor-pointer items-center gap-3"
          >
            <Image
              src="/cnhs-logo.png"
              alt="Cambaog National High School logo"
              width={56}
              height={56}
              data-keep-white="true"
              className="h-11 w-11 shrink-0 rounded-full bg-white object-contain sm:h-12 sm:w-12"
              priority
            />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold uppercase tracking-[-0.01em] text-white sm:text-[17px]">
                Cambaog National High School
              </p>
              <p className="hidden text-[10px] text-white/70 sm:block">
                Cambaog, Bustos, Bulacan
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <nav
              aria-label="Main navigation"
              className="hidden items-center gap-5 lg:flex"
            >
              {navigation.map(([label, href], index) => (
                <a
                  key={label}
                  href={href}
                  className={`cursor-pointer border-b-2 py-2 text-[9px] font-semibold uppercase tracking-[0.05em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c430] ${
                    index === 0
                      ? "border-[#f4c430] text-white"
                      : "border-transparent text-white/75 hover:text-white"
                  }`}
                >
                  {label}
                </a>
              ))}
              <button
                type="button"
                aria-label="Search"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c430]"
              >
                <Search size={14} />
              </button>
            </nav>
            <PortalLoginButton />
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/15 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c430] lg:hidden"
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
            className="absolute inset-x-4 top-[4.85rem] overflow-hidden rounded-xl border border-white/10 bg-[#073d25] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.3)] lg:hidden"
          >
            {navigation.map(([label, href]) => (
              <a
                key={label}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                className="block cursor-pointer rounded-lg px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c430]"
              >
                {label}
              </a>
            ))}
          </motion.nav>
        ) : null}
      </header>

      <main>
        <section
          id="home"
          className="relative min-h-[640px] overflow-hidden bg-[#0a4c2a] pt-[4.5rem] sm:min-h-[720px]"
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

          <div className="relative z-10 mx-auto flex min-h-[560px] max-w-[1440px] items-center px-6 pb-20 pt-20 sm:min-h-[640px] sm:px-10 lg:px-28 xl:px-36">
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
            </motion.div>
          </div>
        </section>

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

      <footer id="contact" className="border-t border-white/10 bg-[#072c1c]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-start gap-3.5">
            <Image
              src="/cnhs-logo.png"
              alt="Cambaog National High School logo"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 object-contain"
            />
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-white">
                {loginContent.schoolName}
              </p>
              <p className="mt-1 max-w-md text-[11px] leading-relaxed text-white/60">
                Cambaog, Bustos, Bulacan · CNHS Learn
              </p>
            </div>
          </div>
          <p className="text-[10px] text-white/50">
            Authorized school accounts only.
          </p>
        </div>
      </footer>
    </div>
  );
}
