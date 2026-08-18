"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import LoginForm from "@/components/auth/LoginForm";
import LoginHero from "@/components/auth/LoginHero";
import { loginContent } from "@/lib/constants/loginContent";

export default function AuthLayout() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="portal-body relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6"
    >
      <div className="portal-page__bg absolute inset-0" aria-hidden="true">
        <Image
          src={loginContent.backgroundSrc}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(14,72,45,0.85) 0%, rgba(14,72,45,0.55) 40%, rgba(14,72,45,0.20) 70%, rgba(14,72,45,0.05) 100%)",
          }}
        />
      </div>

      <main className="portal-page relative z-10 w-full max-w-[980px]" aria-label="CNHS Learn login">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
          className="auth-container flex w-full overflow-hidden rounded-[24px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        >
          <LoginHero />
          <LoginForm />
        </motion.div>
      </main>
    </motion.div>
  );
}
