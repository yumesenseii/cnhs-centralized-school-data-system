import { Suspense } from "react";
import ClassOrganizationPage from "@/components/class-organization/ClassOrganizationPage";

export const metadata = {
  title: "Classes & Sections | CNHS Learn",
  description:
    "Manage grade sections and teacher class assignments in one place.",
};

export default function ClassOrganizationRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading class organization...
        </div>
      }
    >
      <ClassOrganizationPage />
    </Suspense>
  );
}
