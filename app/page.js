import AuthRecoveryRedirect from "@/components/auth/AuthRecoveryRedirect";
import PortalLanding from "@/components/landing/PortalLanding";
import ForceLightMode from "@/components/theme/ForceLightMode";

export const metadata = {
  title: "Cambaog National High School | CNHS Learn",
  description:
    "CNHS Learn — secure access for School Principals, Teachers, and Students.",
};

export default function Home() {
  return (
    <ForceLightMode>
      <AuthRecoveryRedirect />
      <PortalLanding />
    </ForceLightMode>
  );
}
