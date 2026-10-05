import { redirect } from "next/navigation";

export default function AdvisoryClassRedirectPage() {
  redirect("/teacher/my-classes?tab=advisory");
}
