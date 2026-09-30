import { redirect } from "next/navigation";

export const metadata = {
  title: "Input Grades | CNHS Learn",
  description: "Grade entry and E-Class Records are managed directly in My Classes.",
};

export default function InputGradesRoute() {
  redirect("/teacher/my-classes");
}
