import { HeaderActions } from "@/components/reports/ActionButtons";
import Header from "@/components/layout/Header";

export default function ReportsHeader() {
  return (
    <Header
      breadcrumb="Home / Reports"
      title="Reports"
      controls={<HeaderActions />}
    />
  );
}
