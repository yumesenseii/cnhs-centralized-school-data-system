"use client";

import { BookOpenCheck } from "lucide-react";

export default function EmptyAssignedClassesState() {
  return (
    <section
      role="status"
      className="mt-4 flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white px-6 py-10 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-cnhs-green-dark">
        <BookOpenCheck size={26} strokeWidth={1.7} />
      </span>
      <h2 className="mt-3 text-base font-semibold tracking-[-0.02em] text-slate-800">
        No classes have been assigned to you.
      </h2>
      <p className="mt-2 max-w-md text-[12px] leading-5 text-slate-500">
        Class assignments are created by your school administrator. Once a
        subject and section are assigned to your account, they will appear here
        automatically.
      </p>
    </section>
  );
}
