import HeaderShell from "@/components/layout/Header";

export default function Header({
  description = "Welcome back. Here is today's learner risk overview.",
  controls,
}) {
  return (
    <HeaderShell
      breadcrumb="Home / Dashboard"
      title="Overview"
      description={description}
      controls={controls}
    />
  );
}
