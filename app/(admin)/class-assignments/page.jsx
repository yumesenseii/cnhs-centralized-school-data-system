import { redirect } from "next/navigation";

export default function ClassAssignmentsRedirectPage() {
  redirect("/class-organization?tab=assignments");
}
