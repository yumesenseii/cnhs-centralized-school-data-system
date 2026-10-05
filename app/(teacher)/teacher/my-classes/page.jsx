import { Suspense } from "react";
import MyClasses from "@/components/teacher/my-classes/MyClasses";

export const metadata = {
  title: "My Classes | CNHS Learn",
  description: "View classes assigned by the school administrator.",
};

export default function MyClassesPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading assigned classes...
        </div>
      }
    >
      <MyClasses />
    </Suspense>
  );
}
