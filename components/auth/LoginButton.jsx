"use client";

import { motion } from "framer-motion";
import { LoaderCircle } from "lucide-react";

export default function LoginButton({ children, loading = false, disabled = false }) {
  return (
    <motion.button
      type="submit"
      disabled={disabled || loading}
      whileHover={{ y: disabled || loading ? 0 : -1 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.985 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#174D37] text-[13px] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#123D2C] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? <LoaderCircle size={16} className="animate-spin" /> : null}
      {children}
    </motion.button>
  );
}
