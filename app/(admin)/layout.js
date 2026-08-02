import Sidebar from "@/components/layout/Sidebar";
import { SIDEBAR_CONTENT_OFFSET_CLASS } from "@/lib/constants/layout";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-cnhs-page">
      <Sidebar className="hidden lg:flex" />
      <div className={cn("min-h-screen", SIDEBAR_CONTENT_OFFSET_CLASS)}>
        <main className="mx-auto w-full max-w-[1180px] px-3 py-3 sm:px-4 lg:px-4 lg:py-3">
          {children}
        </main>
      </div>
    </div>
  );
}
