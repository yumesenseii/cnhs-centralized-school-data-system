import { redirect } from "next/navigation";

export default function SectionsRedirectPage() {
  redirect("/class-organization?tab=sections");
}
